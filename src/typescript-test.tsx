import * as ts from 'ts-morph'
import { s, Part, Switch } from 'stsx'
import { Base } from './tpl'
import css from './css'
import { Class, FnProto, Interface, TypeAlias, ParamOrVar, VarDecl } from './widgets'

// process.chdir('/home/chris/swapp/optdeps/elt')
const p = new ts.Project({
  tsConfigFilePath: `${process.argv[2]}/tsconfig.json`
})
// p.addSourceFileAtPath('/home/chris/swapp/optdeps/elt-ui/src/index.ts')
const src = p.getSourceFile('index.ts')!

// I want the objects marked as @api to be shown at the root of the documentation.
// the rest should be explored as the links get clicked.

// console.log(src.getExportDeclarations().map(e => e.getText()))
// console.log(src.getExportAssignments().map(e => e.getText()))

// What we should handle :
// Variable
// Function
// Class
// Enum
// TypeAlias
// Interface
// Namespace (which contains the rest)

function handleType(t: ts.Type) {
  if (t.isTuple()) {

  } else if (t.isArray()) {

  // Now, the types where we could have type parameters.
  } else if (t.isClass() || t.isInterface()) {

  }
}


// All the nodes that are to be rendered.
// path is the symbol or the namespace-qualified name
export const rendered = new Map<string, {
  nodes: ts.Node[],
  path: string // the path to the output file corresponding to the single-doc page.
}>()


function clean_comment(comment: string) {
  return comment.replace(/^([ \t]*\/\*\*?[ \t]*|[ \t]*\*\/|[ \t]*\*[ \t]*)/gm, '')
}

function isTOC(n: ts.ExportedDeclarations[]) {
  for (var node of n) {
    if (isDocumentable(node)) {
      var docs = ''
      if (node instanceof ts.VariableDeclaration) {
        var p = node.getParent()
        if (!(p instanceof ts.VariableDeclarationList)) return false
        var p2 = p.getParent()
        if (!(p2 instanceof ts.VariableStatement)) return false
        docs = p2.getJsDocs().map(d => clean_comment(d.getText())).join('\n')
      } else {
        docs = node.getJsDocs().map(d => clean_comment(d.getText())).join('\n')
      }
      // console.log(docs)
      return docs.includes('@api')
    }
    // if (node instanceof ts.ClassDeclaration) {
    // } else if (node instanceof ts.FunctionDeclaration) {
    //   const dc = node.getStructure().docs
    //   return dc?.map(d => !d ? '' : typeof d === 'string' ? d : d.description ).join('').includes('@api')
    // }
  }
  return false
}


export const DocumentableTypes = [
  ts.ClassDeclaration,
  ts.InterfaceDeclaration,
  ts.FunctionDeclaration,
  ts.NamespaceDeclaration,
  ts.VariableDeclaration,
  ts.EnumDeclaration,
  ts.TypeAliasDeclaration
] as const

// All the symbols we are going to provide documentation for.
export type Documentable =
  ts.ClassDeclaration |
  ts.InterfaceDeclaration |
  ts.FunctionDeclaration |
  ts.NamespaceDeclaration |
  ts.VariableDeclaration |
  ts.EnumDeclaration |
  ts.TypeAliasDeclaration

function isDocumentable(item: ts.Node): item is Documentable {
  for (var i = 0, l = DocumentableTypes.length; i < l; i++)
    if (item instanceof DocumentableTypes[i]) return true
  return false
}


export const documented_symbols = [] as [string, Documentable[]][]


function handleExportedDeclarations(decls: ReadonlyMap<string, ts.ExportedDeclarations[]>, prefix = '') {
  var res = [] as [string, Documentable[]][]

  for (var exp of decls) {
    var [name, bl] = exp
    var full_name = prefix ? `${prefix}.${name}` : name
    if (bl.filter(b => b instanceof ts.FunctionDeclaration).length > 1) {
      var i = bl.length - 1
      findfn: while (i >= 0) {
        if (bl[i] instanceof ts.FunctionDeclaration) {
          bl.splice(i, 1)
          break findfn
        }
        i--
      }
    }
    res.push([full_name, bl as Documentable[]])
    // console.log(full_name, bl.map(node => node.constructor.name))
    for (var node of bl) {

      // console.log(full_name, node.constructor.name)
      // console.log('===>', st)
      // console.log(st, ed.getSourceFile().getBaseName(), ed.getStartLineNumber())
      // if (node instanceof ts.ClassDeclaration) {
        // console.log(<Class cls={node}/>)

        // console.log(node.getStaticMembers().map(m => [`${full_name}.${m.getName()}`, m.constructor.name]))

        // const ext = node.getExtends()
        // const impl = node.getImplements()
        // if (ext) {
          // const typ = ext.getType()
          // if (typ.isClassOrInterface()) {
            // console.log(typ)
          // }
          // How to retrieve the original location of a symbol !
          // console.log(name, ext.getType().getSymbol()?.getValueDeclaration()?.getSourceFile().getFilePath())
        // }
        // console.log(st.name)
        // console.log(st.docs)
        // console.log(st.name, st.extends, st.implements, st.methods?.map(m => m.name))
      // } else if (node instanceof ts.FunctionDeclaration) {
        // we're going to have to add arguments and return type to the rendered nodes.
        // if they're API then they're added to the TOC.
        // there should be a "namespace" path somewhere, since we're considering coming from an entry point
        // o.Observable
        // tf.stuff
        // const st = node.getStructure()
        // console.log('function', st.returnType)
      // } else if (node instanceof ts.VariableDeclaration) {
        // const st = node.getStructure()
        // console.log('var', st.name)
      if (node instanceof ts.NamespaceDeclaration || node instanceof ts.SourceFile) {
        // const st = node.getStructure()
        res = [...res, ...handleExportedDeclarations(node.getExportedDeclarations(), full_name)]
      }
    }
  }
  return res
}

// CETTE FONCTION FAIT LE CAFÉ !!!
const res = handleExportedDeclarations(src.getExportedDeclarations())
res.sort()

class Test extends Part {
  base = this.use(Base)

  init() {
    this.base.title = 'elt documentation'
     this.body.push(() => <>
      {res.map(([name, syms]) => <div class={css.block}>{syms.map(t =>
        t instanceof ts.FunctionDeclaration ? <FnProto name={name} proto={t}/> :
        t instanceof ts.ClassDeclaration ? <Class name={name} cls={t}/> :
        t instanceof ts.InterfaceDeclaration ? <Interface name={name} cls={t}/> :
        t instanceof ts.TypeAliasDeclaration ? <TypeAlias name={name} typ={t}/> :
        t instanceof ts.VariableDeclaration ? <VarDecl name={name} v={t}/> :
        t.constructor.name
      )}</div>)}
    </>)
  }
}

var t = new Test()
t.init()
import * as fs from 'fs'
t.get(Base).Main().render(fs.createWriteStream('./out/doc.html'))
// console.log(res.map(r => r[0]))

// console.log(src.getExportedDeclarations())