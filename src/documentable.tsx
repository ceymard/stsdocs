import * as ts from 'ts-morph'
import * as pth from 'path'
import * as fs from 'fs'

function clean_comment(comment: string) {
  return comment.replace(/^([ \t]*\/\*\*?[ \t]*|[ \t]*\*\/|[ \t]*\*[ \t]*)/gm, '')
}

function sorter<T>(ex: (a: T) => string): (a: T, b: T) => -1 | 0 | 1 {
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
  ts.ClassDeclaration |
  ts.InterfaceDeclaration |

  FunctionTypes |
  VariableTypes |

  // FIXME IndexSignatureDeclaration
  ts.IndexSignatureDeclaration |

  ts.NamespaceDeclaration |

  ts.EnumDeclaration |
  ts.TypeAliasDeclaration

function I(v: any, b: any): v is InstanceType<typeof b> {
  return v instanceof b
}

interface IHasModifiers {
  getModifiers(): ts.Node[]
}

function hasModifiers(v: any): v is IHasModifiers {
  return 'getModifiers' in v
}

// All the symbols we are going to provide documentation for.
// export type Documentable = { getJsDocs(): ts.JSDoc[], getSourceFile(): ts.SourceFile }

export class Documentable {

  docs = ''
  modifiers = new Set<string>() // const, static, public, async, protected ... only valid for methods and properties
  tags = new Set<string>()

  constructor(
    public name: string,
    public declarations: DocumentableTypes[] = []
  ) {
    this.parse()

    this.withClass((name, c) => {
      console.log(name, c.getName())
      this.members.forEach(m => {
        console.log([m.name, m.modifiers])
      })
    })
  }

  parse() {
    var tags = new Set<string>()
    var first = this.declarations[0]
    var src_path = first.getSourceFile().getFilePath()

    for (var d of this.declarations) {
      if (hasModifiers(d))
        for (var m of d.getModifiers())
          this.modifiers.add(m.getText().trim())
    }

    var clean = clean_comment(
      this.declarations.map(d => {
      var dc = d instanceof ts.VariableDeclaration ? ((d.getParent() as ts.VariableDeclarationList).getParent() as ts.VariableStatement).getJsDocs() : d.getJsDocs()
      return dc.map(d => d.getText())
    }).join('\n\n').trim())
      .replace(/@param (\w+)/g, (_, m) => ` - **\`${m}\`**`)
      .replace(/@returns?/g, () => ` - **returns**`)
      .replace(/@category ([^\n]+)\n?/g, (_, cats: string) => {
        for (var c of cats.trim().split(/\n,\n/g))
          tags.add(c.trim())
        return ''
      })
      .replace(/@include\s*([^\n]+)\s*\n?/g, (_, path: string) => {
        var try_path = pth.join(pth.dirname(src_path), path)
        try {
          return fs.readFileSync(try_path, 'utf-8')
        } catch (e) {
          return `file not found: "${try_path}"`
        }
        return 'PATH'
      })
    this.docs = clean
    this.tags = tags
    return clean
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
        members_with_names.push(['0-constructor', 'constructor', m])
      else if (m instanceof ts.MethodDeclaration || m instanceof ts.PropertyDeclaration || m instanceof ts.GetAccessorDeclaration || m instanceof ts.SetAccessorDeclaration) {
        const mods = m.getModifiers().map(m => m.getText().trim())
        if (mods.includes('static'))
          members_with_names.push(['4-' + m.getName(), 'static ' + m.getName(), m])
        else
          members_with_names.push(['3-' + m.getName(), m.getName(), m])
      } else {
        // get statics
        members_with_names.push(['3-' + m.getName(), m.getName(), m])
      }
    }

    members_with_names.sort(sorter(m => m[0]))
    var grouped_members = new MapArray<string, DocumentableTypes>()
    for (const [_, name, item] of members_with_names) {
      grouped_members.add(name, item)
    }

    var res: Documentable[] = []
    for (const [name, items] of grouped_members) {
      res.push(new Documentable(name, items))
    }

    return res
    // console.log(members_with_names.map(m => m[1]))
    // we will have to group the methods by name, since they are just the same symbol in JS.
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
      return 'variable'
    if (I(f, ts.TypeAliasDeclaration))
      return 'type'
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
      this.declarations as FunctionTypes[]
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

  get namespace() {
    // @ts-ignore
    return this.as(ts.NamespaceDeclaration)
  }

  get variable() {
    var first = this.declarations[0]
    if (
      first instanceof ts.VariableDeclaration ||
      first instanceof ts.PropertyDeclaration ||
      first instanceof ts.PropertySignature
    )
      this.declarations as VariableTypes[]
    return null
  }

  withFunctions<T>(fn: (name: string, t: FunctionTypes[]) => T): T | null {
    var f = this.functions
    return f ? fn(this.name, f) : null
  }

  withClass<T>(fn: (name: string, t: ts.ClassDeclaration) => T): T | null {
    var f = this.class
    return f ? fn(this.name, f) : null
  }

  withInterface<T>(fn: (name: string, t: ts.InterfaceDeclaration) => T): T | null {
    var f = this.interface
    return f ? fn(this.name, f) : null
  }

  withTypealias<T>(fn: (name: string, t: ts.TypeAliasDeclaration) => T): T | null {
    var f = this.type
    return f ? fn(this.name, f) : null
  }

  withNamespace<T>(fn: (name: string, t: ts.NamespaceDeclaration) => T): T | null {
    var f = this.namespace
    return f ? fn(this.name, f) : null
  }

  withVariable<T>(fn: (name: string, t: ts.VariableDeclaration) => T): T | null {
    var f = this.variable
    return f ? fn(this.name, f) : null
  }

  withEnum<T>(fn: (name: string, t: ts.EnumDeclaration) => T): T | null {
    var f = this.enum
    return f ? fn(this.name, f) : null
  }

}