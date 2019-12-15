import * as ts from 'ts-morph'
import { s, Part, Repeat } from 'stsx'
import { Base } from './tpl'
import css from './css'
import { Class, FnProto, Interface, TypeAlias, VarDecl, ClassMember } from './widgets'

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
// Namespace (which contains the rest) | Modules
// missing Expression, probably in the case of default exports


// All the nodes that are to be rendered.
// path is the symbol or the namespace-qualified name
export const rendered = new Map<string, {
  nodes: ts.Node[],
  path: string // the path to the output file corresponding to the single-doc page.
}>()


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
export type Documentable = { getJsDocs(): ts.JSDoc[], getSourceFile(): ts.SourceFile }

export const documented_symbols = [] as [string, Documentable[]][]


function handleExportedDeclarations(decls: ReadonlyMap<string, ts.ExportedDeclarations[]>, prefix = '') {
  var res = [] as [string, Documentable[]][]

  for (var exp of decls) {
    var [name, bl] = exp
    var full_name = prefix ? `${prefix}.${name}` : name
    var d = [] as ts.ExportedDeclarations[]

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

    for (var node of bl) {
      if (node instanceof ts.NamespaceDeclaration || node instanceof ts.SourceFile) {
        // const st = node.getStructure()
        res = [...res, ...handleExportedDeclarations(node.getExportedDeclarations(), full_name)]
      } else {
        d.push(node)
      }
    }

    if (d.length)
      res.push([full_name, d as Documentable[]])
  }
  return res
}

// CETTE FONCTION FAIT LE CAFÉ !!!
const res = handleExportedDeclarations(src.getExportedDeclarations())
res.sort()

// FIXME sort members !
class Test extends Part {
  base = this.use(Base)

  init() {
    this.base.title = 'elt documentation'
     this.body.push(() => <>
      {res.map(([name, syms]) => <div class={css.block}>
        {syms.map(t =>
          t instanceof ts.FunctionDeclaration ? <FnProto name={name} proto={t}/> :
          t instanceof ts.ClassDeclaration ? <>
            <Class name={name} cls={t}/>
            {Repeat(t.getMembersWithComments(), m => <ClassMember member={m}/>)}
          </>:
          t instanceof ts.InterfaceDeclaration ? <>
            <Interface name={name} cls={t}/>
            {Repeat(t.getMembersWithComments(), m => <ClassMember member={m}/>)}
          </> :
          t instanceof ts.TypeAliasDeclaration ? <TypeAlias name={name} typ={t}/> :
          t instanceof ts.VariableDeclaration ? <VarDecl name={name} v={t}/> :
          t instanceof ts.NamespaceDeclaration ? <div class={css.kind_namespace}>
            <div class={css.name}><span class={css.kind}>namespace</span><b>{name}</b></div>
          </div> : ''
        )}
      </div>)}
    </>)
  }
}

var t = new Test()
t.init()
import * as fs from 'fs'
t.get(Base).Main().render(fs.createWriteStream('./out/doc.html'))
// console.log(res.map(r => r[0]))

// console.log(src.getExportedDeclarations())