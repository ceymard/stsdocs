import * as ts from 'ts-morph'
import * as fs from 'fs'
import { s, Child, raw } from 'stsx'
import { Documentable, sorter } from './documentable'
import { Template } from './tpl'
import css from './css'
import { Class, Interface, FnProto, VarDecl, TypeAlias } from './widgets'

// markdown
import * as m from 'markdown-it'
// import * as h from 'highlight.js'
import * as prism from 'prismjs'
require('prismjs/components/prism-jsx.min')

var md = m({
  highlight: (str, lang) => {
    try {
      return prism.highlight(str, prism.languages.jsx, 'jsx')
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
    <div class={css.doc}>{raw(md.render(doc.docs))}</div>

    {doc.withMembers(members => <div class='st-nest'>
      {members.map(m => <Declaration doc={m}/>)}
    </div>)}

  </div>
}

function DocTemplate(a: {doc: Documentable}, ch: Child[]) {
  var all_declarations = coalesce_namespaces(doc)
  all_declarations.sort(sorter(a => a.name))

  return <Template title={`${doc.sourcefile?.getFilePath() ?? ''} documentation`}>
    <div class='st-row'>
       <div class='st-toc'>
          {all_declarations.map(e =>
            <a class={'st-kind-' + e.kind} href={`#${e.name}`}>{e.name.includes('.') ? e.name : <b>{e.name}</b>}</a>
          )}
       </div>
       <div class='st-docmain'>
        {all_declarations.map(decl => <Declaration doc={decl}/>)}
       </div>
    </div>
  </Template>
}

var t = (<DocTemplate doc={doc}></DocTemplate>)
t.render(fs.createWriteStream('./out/doc.html'))

// for (var _ of map.entries()) {
//   // console.log(_[0], _[1].map(d => d.name))
// }
// console.log(map)
// res.forEach(d => console.log([d.name, d.kind, d.tags]))

/**
function sorter<T>(ex: (a: T) => string): (a: T, b: T) => -1 | 0 | 1 {
  return function (a, b) {
    var e_a = ex(a)
    var e_b = ex(b)
    if (e_a < e_b) return -1
    if (e_a > e_b) return 1
    return 0
  }
}

export type FilterTypes<T, Excl> = T extends Excl ? never : T

const method_sorter = sorter<ts.ClassMemberTypes | ts.TypeElementTypes | ts.CommentClassElement | ts.CommentTypeElement>(elt => {
  if (elt instanceof ts.CommentClassElement || elt instanceof ts.CommentTypeElement) return ''
  if (elt instanceof ts.ConstructorDeclaration
      || elt instanceof ts.ConstructSignatureDeclaration
      || elt instanceof ts.CallSignatureDeclaration
      || elt instanceof ts.IndexSignatureDeclaration
    )
    return '2-new'
  var name = elt.getName()
  if (elt instanceof ts.PropertyDeclaration || elt instanceof ts.PropertySignature)
    return '0-' + name
  if (elt instanceof ts.GetAccessorDeclaration)
    return `1-${name}-get`
  if (elt instanceof ts.SetAccessorDeclaration)
    return `1-${name}-set`
  if (elt instanceof ts.MethodDeclaration || elt instanceof ts.MethodSignature)
    return `3-${name}`
  return '6-' + name
})

function kind(v: Documentable[]) {
  var first = v[0]
  if (first instanceof ts.ClassDeclaration)
    return css.kind_class
  if (first instanceof ts.InterfaceDeclaration)
    return css.kind_interface
  if (first instanceof ts.TypeAliasDeclaration)
    return css.kind_typealias
  if (first instanceof ts.FunctionDeclaration)
    return css.kind_function
  return css.kind_var
}

// FIXME sort members !
// Filter out private or internal fields
// Treat static members as variable declarations.
class Test extends Part {
  base = this.use(Base)

  init() {
    this.base.title = 'elt documentation'
     this.body.push(() => <div class='st-row'>
       <div class='st-toc'>
        {res.filter(f => !f[0].includes('.')).map(([name, syms]) => <a class={kind(syms)} href={`#${name}`}>{name.includes('.') ? name : <b>{name}</b>}</a>)}
       </div>
       <div class='st-docmain'>
      {res.map(([name, syms]) => <div class={css.block} id={name}>
        {syms.map(t =>
          t instanceof ts.FunctionDeclaration ? <FnProto name={name} proto={t}/> :
          t instanceof ts.ClassDeclaration ? <>
            <Class name={name} cls={t}/>
            {Repeat(t.getMembersWithComments().filter(m => {
              if (m instanceof ts.CommentClassElement) return false
              var modifiers = m.getModifiers().map(m => m.getText())
              // var docs = m.getJsDocs()
              // console.log(docs.map(d => d.getTags().map(t => t.getText())))
              // readonly static protected public private
              if(modifiers.includes('private') || modifiers.includes('static') || modifiers.includes('protected'))
                return false
              return true
            }).slice().sort(method_sorter), m => <ClassMember member={m}/>)}
          </>:
          t instanceof ts.InterfaceDeclaration ? <>
            <Interface name={name} cls={t}/>
            {Repeat(t.getMembersWithComments().slice().sort(method_sorter), m => <ClassMember member={m}/>)}
          </> :
          t instanceof ts.TypeAliasDeclaration ? <TypeAlias name={name} typ={t}/> :
          t instanceof ts.VariableDeclaration ? <VarDecl name={name} v={t}/> :
          t instanceof ts.NamespaceDeclaration ? <div class={css.kind_namespace}>
            <div class={css.name}><span class={css.kind}>namespace</span><b>{name}</b></div>
          </div> : ''
        )}
      </div>)}
      </div>
    </div>)
  }
}

var t = new Test()
t.init()
import * as fs from 'fs'
t.get(Base).Main().render(fs.createWriteStream('./out/doc.html'))
*/