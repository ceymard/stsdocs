import * as ts from 'ts-morph'
import * as fs from 'fs'
import * as pth from 'path'
import { s, Child, raw, include } from 'stsx'
import { Documentable, sorter, MapArray } from './documentable'
import { Template, MoreHead } from './tpl'
import css from './css'
import { Class, Interface, FnProto, VarDecl, TypeAlias } from './widgets'

// markdown
import * as m from 'markdown-it'
// import * as h from 'highlight.js'
import * as prism from 'prismjs'
require('prismjs/components/')(['javascript', 'typescript', 'jsx', 'tsx', 'bash', 'json'])


var md = m({
  highlight: (str, lang) => {
    try {
      // console.log(str, lang)
      var res = prism.highlight(str, prism.languages[lang], lang)
      return `<pre class='language-${lang}'><code>${res}</code></pre>`
      // return h.highlight(lang, str).value;
    } catch (__) {
      console.error(prism.languages[lang], lang)
      console.error(Object.keys(prism.languages))
    }

    return ''; // use external default escaping
  }
})


const PROJECT_BASE = process.argv[2]
const p = new ts.Project({
  tsConfigFilePath: `${PROJECT_BASE}/tsconfig.json`
})
// p.addSourceFileAtPath('/home/chris/swapp/optdeps/elt-ui/src/index.ts')
const src = p.getSourceFile('index.ts')!

var doc = new Documentable('', [src])

// const res = handleExportedDeclarations(src.getExportedDeclarations())
// res.sort(sorter(a => a.name))

// var map = new MapArray<string, Documentable>()

function coalesce_namespaces(doc: Documentable, res: Documentable[] = []) {
  for (var d of doc.exports) {
    if (d.namespace) {
      coalesce_namespaces(d, res)
    } else {
      res.push(d)
    }
  }
  return res
}

function Declaration({doc}: {doc: Documentable}) {
  return <div class={css.block} id={doc.name} data-categories={[...doc.categories].join(',')} data-tags={[...doc.tags].join(',')}>
    {doc.withClass((name, cls) => <Class name={name} cls={cls} />)}
    {doc.withInterface((name, cls) => <Interface name={name} cls={cls} />)}
    {doc.withFunctions((name, fns) => {
      return fns.map(f => <FnProto name={name} proto={f} kind={fns[0] instanceof ts.FunctionDeclaration ? 'function' : fns[0] instanceof ts.MethodDeclaration || fns[0] instanceof ts.MethodSignature ? 'method' : undefined}/>)
    })}
    {doc.withVariable((name, cls) => <VarDecl name={name} v={cls}/>)}
    {doc.withTypealias((name, cls) => <TypeAlias name={name} typ={cls}/>)}
    <div class={css.doc}>{doc.docs ? raw(md.render(doc.docs)) : (console.warn(`${doc.name} is not documented`), '¯\\_(ツ)_/¯')}</div>

    {doc.withMembers(members => <div class='st-nest'>
      {members.filter(m => !m.tags.has('internal')).map(m => {
        // console.log(doc.name + '.' + m.name, m.declarations.length)
        return <Declaration doc={m}/>
      })}
    </div>)}

  </div>
}

function DocTemplate(a: {doc: Documentable}, ch: Child[]) {
  var all_declarations = coalesce_namespaces(doc)
  all_declarations.sort(sorter(a => a.name))

  var by_categories = new MapArray<string | null, Documentable>()

  for (var d of all_declarations) {
    for (var c of d.categories) {
      by_categories.add(c, d)
    }
  }

  for (var d of all_declarations) {
    if (d.categories.size === 0) {
      by_categories.add(null, d)
    }
  }

  var doc_id = 0
  var titles: [string, string, string, number][] = []
  var counters: number[] = [0]

  const doc_html = md.render(Documentable.doclinks(fs.readFileSync(PROJECT_BASE + '/README.md', 'utf-8')), {
    html: true
  }).replace(/<(h\d+)[^]+?<\/\1>/g, header => {
    const id = `_doc${doc_id++}`
    const nb = parseInt(/<h(\d+)/.exec(header)![1])
    counters = counters.slice(0, nb)
    while (counters.length < nb) { counters.push(0) }
    counters[counters.length - 1]++
    titles.push([header.replace(/<[^>]+>(.*)<\/[^>]+>/, (_, cnt) => cnt), id, counters.join('.') + '. ', nb])
    return header.replace(/^<h\d+/, start => start + ` id="${id}"`)
    // return header + ` id='doc${doc_id++}'`
  })

  return <Template title={`${pth.basename(PROJECT_BASE) ?? ''} documentation`}>
    <div class='st-row'>
      <div id='sidebar' class='flex-column'>
        <div id='searchdiv'>
          <input id='search' class='st-search' placeholder='search...'/>
        </div>
        <div id='toc' class='st-toc flex-absolute-grow'>
          {titles.map(t => <a class={`toc-entry toc-nest-${t[3]}`} href={'#' + t[1]}><b>{t[2]}</b> {raw(t[0])}</a>)}
          {Array.from(by_categories.entries()).filter(c => c[0] && c[0] !== 'toc').map(([category, declarations]) => <>
            <h3>{category?.replace(/^[a-z]/, m => m.toUpperCase()) ?? 'Other'}</h3>
            {declarations.filter(d => d.categories.has('toc')).map(e =>
              <div><a class={'st-kind-' + e.kind} href={`#${e.name}`}><b>{e.name}{e.kind === 'function' || e.kind === 'method' ? '()' : ''}</b></a></div>
            )}
          </>)}
        </div>
      </div>
      <div class='st-docmain'>
        {raw(doc_html)}
        <h1>API Documentation</h1>
        {all_declarations.filter(d => !d.tags.has('internal')).map(decl => <Declaration doc={decl}/>)}
      </div>
    </div>

    <div style='display: none' id='st-playground-overlay'>
      <div id='st-playground-header'>
        <div>Test code here</div>
        <button id='st-playground-reload'>Reload</button>
      </div>
      <div id='st-playground-root'>
        <div id='st-playground'></div>
        <div id='ifr'></div>
      </div>
    </div>

    <div style='display: none' id='elt-d-ts'>{include('elt/elt.d.ts', {escape: true})}</div>
    <script src='./elt-compile.js'></script>
    <style>{include('prismjs/themes/prism-tomorrow.css')}</style>
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans&family=Oxygen+Mono&display=swap" rel="stylesheet"/>
  </Template>
}

var t = (<DocTemplate doc={doc}></DocTemplate>)
t.render(fs.createWriteStream('./out/index.html'))
