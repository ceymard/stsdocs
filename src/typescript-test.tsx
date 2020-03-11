import * as ts from 'ts-morph'
import * as fs from 'fs'
import { s, Child, raw, include } from 'stsx'
import { Documentable, sorter, MapArray } from './documentable'
import { Template, MoreHead } from './tpl'
import css from './css'
import { Class, Interface, FnProto, VarDecl, TypeAlias } from './widgets'

// markdown
import * as m from 'markdown-it'
// import * as h from 'highlight.js'
import * as prism from 'prismjs'
require('prismjs/components/')(['javascript', 'typescript', 'jsx', 'tsx'])


var md = m({
  highlight: (str, lang) => {
    try {
      var res = prism.highlight(str, prism.languages.jsx, 'tsx')
      return `<pre class='language-tsx'><code>${res}</code></pre>`
      // return h.highlight(lang, str).value;
    } catch (__) {}

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
    <div class={css.doc}>{doc.docs ? raw(md.render(doc.docs)) : '¯\\_(ツ)_/¯'}</div>

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

  return <Template title={`${doc.sourcefile?.getFilePath() ?? ''} documentation`}>
    <div class='st-row'>
      <div class='flex-column'>
        <input id='search' class='st-search' placeholder='filter'/>
        <div class='st-toc flex-absolute-grow'>
          {Array.from(by_categories.entries()).filter(c => c[0] && c[0] !== 'toc').map(([category, declarations]) => <div>
            <h3>{category?.replace(/^[a-z]/, m => m.toUpperCase()) ?? 'Other'}</h3>
            {declarations.filter(d => d.categories.has('toc')).map(e =>
              <div><a class={'st-kind-' + e.kind} href={`#${e.name}`}><b>{e.name}{e.kind === 'function' || e.kind === 'method' ? '()' : ''}</b></a></div>
            )}
          </div>)}
        </div>
      </div>
      <div class='st-docmain'>
        {raw(md.render(Documentable.doclinks(fs.readFileSync(PROJECT_BASE + '/README.md', 'utf-8')), {
          html: true
        }))}
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
    <MoreHead>
      <style>{include('prismjs/themes/prism-tomorrow.css')}</style>
    </MoreHead>
  </Template>
}

var t = (<DocTemplate doc={doc}></DocTemplate>)
t.render(fs.createWriteStream('./out/doc.html'))
