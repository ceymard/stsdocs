import * as ts from 'ts-morph'
import * as fs from 'fs'
import { s, Child, raw, include, If } from 'stsx'
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



const p = new ts.Project({
  tsConfigFilePath: `${process.argv[2]}/tsconfig.json`
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
  return <div class={css.block} id={doc.name}>
    {doc.withClass((name, cls) => <Class name={name} cls={cls} />)}
    {doc.withInterface((name, cls) => <Interface name={name} cls={cls} />)}
    {doc.withFunctions((name, fns) => fns.map(f => <FnProto name={name} proto={f} kind={fns[0] instanceof ts.FunctionDeclaration ? 'F' : fns[0] instanceof ts.MethodDeclaration ? 'M' : undefined}/>))}
    {doc.withVariable((name, cls) => <VarDecl name={name} v={cls}/>)}
    {doc.withTypealias((name, cls) => <TypeAlias name={name} typ={cls}/>)}
    {If(doc.docs, d => <div class={css.doc}>{raw(md.render(d))}</div>)}

    {doc.withMembers(members => <div class='st-nest'>
      {members.map(m => <Declaration doc={m}/>)}
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
          {Array.from(by_categories.entries()).map(([category, declarations]) => <div>
            <h3>{category?.replace(/^[a-z]/, m => m.toUpperCase()) ?? 'Other'}</h3>
            {declarations.map(e =>
              <div><a class={'st-kind-' + e.kind} href={`#${e.name}`}><b>{e.name}</b></a></div>
            )}
          </div>)}
        </div>
      </div>
      <div class='st-docmain'>
        {all_declarations.map(decl => <Declaration doc={decl}/>)}
      </div>
    </div>

    <MoreHead>
      <style>
        {include('node_modules/prismjs/themes/prism-tomorrow.css')}
      </style>
    </MoreHead>
  </Template>
}

var t = (<DocTemplate doc={doc}></DocTemplate>)
t.render(fs.createWriteStream('./out/doc.html'))
