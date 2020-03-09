import * as ts from 'ts-morph'
import * as pth from 'path'
import * as fs from 'fs'

function clean_comment(comment: string) {
  return comment.replace(/^([ \t]*\/\*\*?[ \t]*|[ \t]*\*\/|[ \t]*\*[ \t]?)/gm, '')
}

export function sorter<T>(ex: (a: T) => string): (a: T, b: T) => -1 | 0 | 1 {
  return function (a, b) {
    var e_a = ex(a)
    var e_b = ex(b)
    if (e_a < e_b) return -1
    if (e_a > e_b) return 1
    return 0
  }
}


export class MapArray<K, T> extends Map<K, T[]> {
  add(key: K, val: T) {
    var actual = this.get(key)
    if (!actual) {
      actual = [] as T[]
      this.set(key, actual)
    }
    actual.push(val)
  }
}


export type FunctionTypes = ts.FunctionDeclaration |
  ts.MethodDeclaration |
  ts.ConstructorDeclaration |
  ts.ConstructSignatureDeclaration |
  ts.MethodSignature |
  ts.CallSignatureDeclaration

export type VariableTypes =
  ts.VariableDeclaration |
  ts.PropertyDeclaration |
  ts.PropertySignature |
  ts.GetAccessorDeclaration |
  ts.SetAccessorDeclaration


export type DocumentableTypes =
  ts.SourceFile |
  ts.ClassDeclaration |
  ts.InterfaceDeclaration |

  FunctionTypes |
  VariableTypes |

  // FIXME IndexSignatureDeclaration
  ts.IndexSignatureDeclaration |

  ts.NamespaceDeclaration |

  ts.EnumDeclaration |
  ts.TypeAliasDeclaration

// const sorting_order = [
//   ts.ClassDeclaration,
//   ts.InterfaceDeclaration,
//   ts.VariableDeclaration
// ]

function I(v: any, b: any): v is InstanceType<typeof b> {
  return v instanceof b
}

interface IHasModifiers {
  getModifiers(): ts.Node[]
}

export function hasModifiers(v: any): v is IHasModifiers {
  return 'getModifiers' in v
}

// All the symbols we are going to provide documentation for.
// export type Documentable = { getJsDocs(): ts.JSDoc[], getSourceFile(): ts.SourceFile }

export class Documentable {

  static name_map = new Map<string, Documentable>()
  static node_map = new Map<ts.Node, Documentable>()

  _docs = ''
  modifiers = new Set<string>() // const, static, public, async, protected ... only valid for methods and properties
  categories = new Set<string>()
  tags = new Set<string>()

  constructor(
    public name: string,
    public declarations: DocumentableTypes[] = []
  ) {
    for (var d of declarations) {
      Documentable.node_map.set(d, this)
    }
    this.parse()
    if (this.kind !== 'namespace')
      Documentable.name_map.set(name, this)
  }

  is<Types extends any[]>(...types: Types): boolean {
    var first = this.declarations[0]
    for (var t of types)
      if (first instanceof t) return true
    return false
  }

  get docs(): string {
    return this._docs.replace(/\[\[(.+?)\]\]/g, (m, name) => {
      // var first = this.declarations[0]
      var dc = Documentable.name_map.get(name)
      // console.log(name, dc?.kind)
      return `[\`${name}${dc?.kind === 'function' ? '()' : ''}\`](#${name})`
    })
  }

  parse() {
    var categories = new Set<string>()
    var tags = new Set<string>()
    var first = this.declarations[0]
    var src_path = first.getSourceFile().getFilePath()

    for (var d of this.declarations) {
      if (hasModifiers(d))
        for (var m of d.getModifiers()) {
          var mod = m.getText().trim()
          if (mod !== 'export') this.modifiers.add(mod)
        }
    }

    var clean = clean_comment(
      this.declarations.map(d => {
      var dc = d instanceof ts.VariableDeclaration ? ((d.getParent() as ts.VariableDeclarationList).getParent() as ts.VariableStatement).getJsDocs() : d instanceof ts.SourceFile ? null : d.getJsDocs()
      return (dc ?? []).map(d => {
        for (var t of d.getTags()) {
          tags.add(t.getTagName())
        }
        return d.getText()
      })
    }).join('\n\n').trim())
      .replace(/@param (\w+)/g, (_, m) => ` - **\`${m}\`**`)
      .replace(/@returns?/g, () => ` - **returns**`)
      .replace(/@category ([^\n\*\/]+)\n?/g, (_, cats: string) => {
        for (var c of cats.trim().split(/\s*,\s*/g))
          categories.add(c.trim())
        return ''
      })
      .replace(/@include\s*([^\n]+)\s*\n?/g, (_, path: string) => {
        var try_path = pth.join(pth.dirname(src_path), path)
        try {
          return fs.readFileSync(try_path, 'utf-8')
        } catch (e) {
          return `file not found: "${try_path}"`
        }
      })
      .replace(/^(?:\s*\*\s*)?\s*@([\w_]+)\s*\n+/gm, (m, tag) => (tags.add(tag), ''))
      .replace(/\*\/\s*$/, '')

    this._docs = clean.trim()
    this.tags = tags
    this.categories = categories
    return clean
  }

  get exports() {
    var me = this.namespace ?? this.sourcefile
    if (!me) return []

    var res = [] as Documentable[]

    for (var exp of me.getExportedDeclarations()) {

      var [name, bl] = exp
      var full_name = this.name ? `${this.name}.${name}` : name

      var fns: ts.FunctionDeclaration[] = bl.filter((b: ts.ExportedDeclarations) => b instanceof ts.FunctionDeclaration)

      // if there are overloads, ignore the base one since the rest are
      // the api.
      if (fns.length > 1) {
        fns.splice(fns.length - 1, 1)
      }
      if (fns.length > 0)
        res.push(new Documentable(full_name, fns))

      for (var node of bl) {
        if (node instanceof ts.ClassDeclaration
          || node instanceof ts.EnumDeclaration
          || node instanceof ts.InterfaceDeclaration
          || node instanceof ts.VariableDeclaration
          || node instanceof ts.TypeAliasDeclaration
          || node instanceof ts.NamespaceDeclaration
        )
        {
          res.push(new Documentable(full_name, [node]))
        } else if (node instanceof ts.SourceFile) {
          // const st = node.getStructure()
          // res = [...res, ...handleExportedDeclarations(node.getExportedDeclarations(), full_name)]
        } else if (!(node instanceof ts.FunctionDeclaration)) {

          console.log(node.constructor.name, 'not handled')
        }
      }
    }
    return res

  }

  get display_name() {
    var first = this.declarations[0].compilerNode
    var opt = ''
    if (ts.ts.isMethodSignature(first) || ts.ts.isPropertySignature(first) ) {
      if (first.questionToken)
        opt = '?'
    }

    return this.name.replace(/^.*#/, '') + opt
  }

  get members() {
    var me = this.class ?? this.interface
    if (!me) return []
    var members: (ts.ClassMemberTypes | ts.TypeElementTypes)[] = me.getMembers().filter((m: ts.ClassMemberTypes | ts.TypeElementTypes) => !I(m, ts.CommentClassElement) && !I(m, ts.CommentTypeElement))

    var members_with_names = [] as [string, string, ts.ClassMemberTypes | ts.TypeElementTypes][]

    for (var m of members) {
      if (m instanceof ts.IndexSignatureDeclaration)
        members_with_names.push(['0-[', '', m])
      else if (m instanceof ts.CallSignatureDeclaration)
        members_with_names.push(['0-(', '', m])
      else if (m instanceof ts.ConstructorDeclaration || m instanceof ts.ConstructSignatureDeclaration)
        members_with_names.push(['0-constructor', `${this.name}#constructor`, m])
      else if (m instanceof ts.MethodDeclaration || m instanceof ts.PropertyDeclaration || m instanceof ts.GetAccessorDeclaration || m instanceof ts.SetAccessorDeclaration) {
        const mods = m.getModifiers().map(m => m.getText().trim())
        const nb = [
          m instanceof ts.MethodDeclaration,
          m instanceof ts.GetAccessorDeclaration,
          m instanceof ts.SetAccessorDeclaration,
          m instanceof ts.PropertyDeclaration,
        ].indexOf(true) + 3

        var is_static = mods.includes('static')
        var sortkey = is_static ? `9${nb}-${m.getName()}` : `${nb}-${m.getName()}`
        var name = is_static ? `${this.name}.${m.getName()}` : `${this.name}#${m.getName()}`
        if (m instanceof ts.MethodDeclaration) {
          var overloads = m.getOverloads()
          if (overloads.length) {
            for (var ov of overloads)
              members_with_names.push([sortkey, name, ov])
          } else {
            members_with_names.push([sortkey, name, m])
          }
        } else {
          members_with_names.push([sortkey, name, m])
        }
      } else {
        members_with_names.push(['3-' + m.getName(), `${this.name}#${m.getName()}`, m])
      }
    }

    members_with_names.sort(sorter(m => m[0]))
    var grouped_members = new MapArray<string, DocumentableTypes>()
    // @ts-ignore
    for (const [_, name, item] of members_with_names) {
      grouped_members.add(name, item)
    }

    var res: Documentable[] = []
    for (const [name, items] of grouped_members) {
      var d = new Documentable(name, items)
      if (!d.categories.has('internal')) res.push(d)
    }

    return res
  }

  get kind() {
    var f = this.declarations[0]
    if (I(f, ts.ClassDeclaration))
      return 'class'
    if (I(f, ts.InterfaceDeclaration))
      return 'interface'
    if (I(f, ts.FunctionTypeNode) || I(f, ts.FunctionDeclaration))
      return 'function'
    if (I(f, ts.MethodSignature) || I(f, ts.MethodDeclaration))
      return 'method'
    if (I(f, ts.NamespaceDeclaration))
      return 'namespace'
    if (I(f, ts.EnumDeclaration))
      return 'enum'
    if (I(f, ts.VariableDeclaration))
      return 'var'
    if (I(f, ts.TypeAliasDeclaration))
      return 'typealias'
    if (I(f, ts.ConstructSignatureDeclaration) || I(f, ts.ConstructorDeclaration))
      return 'constructor'
    if (I(f, ts.PropertyDeclaration) || I(f, ts.PropertySignature))
      return 'var'
    if (I(f, ts.CallSignatureDeclaration))
      return 'call'
    return '???'
  }

  get sortname() {
    if (this.functions) return `1-${this.name}`
    return `zz-${this.name}`
  }

  get functions() {
    var first = this.declarations[0]
    if (
      first instanceof ts.FunctionDeclaration ||
      first instanceof ts.MethodDeclaration ||
      first instanceof ts.ConstructorDeclaration ||
      first instanceof ts.ConstructSignatureDeclaration ||
      first instanceof ts.MethodSignature ||
      first instanceof ts.CallSignatureDeclaration ||
      first instanceof ts.FunctionTypeNode
    )
      return this.declarations as FunctionTypes[]
    return null
  }

  as<T>(kls: {new(...a: any[]): T}): T | null {
    var first = this.declarations[0]
    if (first instanceof kls) return first
    return null
  }

  get class() {
    // @ts-ignore
    return this.as(ts.ClassDeclaration)
  }

  get interface() {
    // @ts-ignore
    return this.as(ts.InterfaceDeclaration)
  }

  get type() {
    // @ts-ignore
    return this.as(ts.TypeAliasDeclaration)
  }

  get enum() {
    // @ts-ignore
    return this.as(ts.EnumDeclaration)
  }

  get sourcefile() {
    // @ts-ignore
    return this.as(ts.SourceFile)
  }

  get namespace() {
    // @ts-ignore
    return this.as(ts.NamespaceDeclaration)
  }

  get variable() {
    var first = this.declarations[0]
    if (
      first instanceof ts.VariableDeclaration ||
      first instanceof ts.PropertyDeclaration ||
      first instanceof ts.PropertySignature ||
      first instanceof ts.GetAccessorDeclaration ||
      first instanceof ts.SetAccessorDeclaration
    )
      return first as VariableTypes
    return null
  }

  withFunctions<T>(fn: (name: string, t: FunctionTypes[]) => T): T | null {
    var f = this.functions
    return f ? fn(this.display_name, f) : null
  }

  withClass<T>(fn: (name: string, t: ts.ClassDeclaration) => T): T | null {
    var f = this.class
    return f ? fn(this.display_name, f) : null
  }

  withInterface<T>(fn: (name: string, t: ts.InterfaceDeclaration) => T): T | null {
    var f = this.interface
    return f ? fn(this.display_name, f) : null
  }

  withTypealias<T>(fn: (name: string, t: ts.TypeAliasDeclaration) => T): T | null {
    var f = this.type
    return f ? fn(this.display_name, f) : null
  }

  withNamespace<T>(fn: (name: string, t: ts.NamespaceDeclaration) => T): T | null {
    var f = this.namespace
    return f ? fn(this.display_name, f) : null
  }

  withSourceFile<T>(fn: (t: ts.SourceFile) => T): T | null {
    var f = this.sourcefile
    return f ? fn(f) : null
  }

  withVariable<T>(fn: (name: string, t: VariableTypes) => T): T | null {
    var f = this.variable
    return f ? fn(this.display_name, f) : null
  }

  withEnum<T>(fn: (name: string, t: ts.EnumDeclaration) => T): T | null {
    var f = this.enum
    return f ? fn(this.display_name, f) : null
  }

  withMembers<T>(fn: (members: Documentable[]) => T): T | null {
    var m = this.members
    return m.length > 0 ? fn(m) : null
  }

}