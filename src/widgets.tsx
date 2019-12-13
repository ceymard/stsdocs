import * as ts from 'ts-morph'
import { Attrs, s, raw, If, Repeat } from 'stsx';
import css from './css'

import * as m from 'markdown-it'
// import * as h from 'highlight.js'
import * as prism from 'prismjs'
require('prismjs/components/prism-jsx.min')

import { Documentable } from './typescript-test';
var md = m({
  highlight: (str, lang) => {
    try {
      return prism.highlight(str, prism.languages.jsx, 'jsx')
      // return h.highlight(lang, str).value;
    } catch (__) {}

    return ''; // use external default escaping
  }
})

function clean_comment(comment: string) {
  return comment.replace(/^([ \t]*\/\*\*?[ \t]*|[ \t]*\*\/|[ \t]*\*[ \t]*)/gm, '')
}

function docs(node: Documentable) {
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
  return docs
}

export function Link({text, kind}: Attrs & {text: string, kind: string}) {

}

function T(typ: ts.TypeNode | ts.Type | ts.Expression | undefined | null) {
  return <Type type={typ}/>
}
export function Type({type}: Attrs & {type: ts.TypeNode | ts.Type | ts.Expression | undefined | null}) {
  if (!type) return raw('')
  if (type instanceof ts.Type) {

    if (type.isLiteral()
      || type.isAny()
      || type.isBoolean()
      || type.isNull()
      || type.isUndefined()
      || type.isNumber()
      || type.isString()
      || type.isUnknown()
      || ['void'].includes(type.getText())
    ) {
      return <span>{type.getText()}</span>
    } else if (type.isUnion()) {
      return <span>{Repeat(type.getUnionTypes(), typ => T(typ), ' | ')}</span>
    } else if (type.isTuple()) {
      return <span>[{Repeat(type.getTupleElements(), typ => T(typ), ', ')}]</span>
    } else if (type.isIntersection()) {
      return <span>{Repeat(type.getIntersectionTypes(), typ => T(typ), ' & ')}</span>
    } else if (type.getArrayElementType()) {
      console.log('!@#!@#!@#')
    } else if (type.isAnonymous()) {
      // we'll try to get a declaration, at least
      // var res = type.getSymbol()?.getTypeAtLocation(type.getSymbol()?.getValueDeclaration()!)
      // console.log('RESOLVED', )
      // return <span>{res ? <Type type={res}/> : type.getText()}</span>
    }

    // if we get here, it means we couldn't find out what type we had, so we're gonna try to
    // resolve the expression.
    var decls = type.getSymbol()?.getDeclarations()
    if (decls) {
      var first = decls[0]
      if (ts.Node.isClassDeclaration(first) || ts.Node.isInterfaceDeclaration(first)) {
        // Problem : we lose the qualified name and mostly the type parameters.
        var ta = type.getTypeArguments()
        // THERE IS A LINK HERE AS WELL !
        return <span>{first.getName()}{ta.length ? <>&lt;{Repeat(ta, a => T(a), ', ')}&gt;</> : ''}</span>
      }

      // FIXME
      // return <span>INFER ANON {type.getText()} [{decls.map(d => d.constructor.name)}]</span>
      return <span>{type.getText().replace(/import\("[^"]*"\)\./g, '')}</span>
    }

    console.log('TYPE - ', type.constructor.name, type.getText())
    return <span>INFERRED TYPE ({type.getText()}) [{type.compilerType.isClass()}]</span>

  } else if (type instanceof ts.TypeNode) {

    if (ts.Node.isUnionTypeNode(type)) {
      return <span>{Repeat(type.getTypeNodes(), typ => T(typ), ' | ')}</span>
    } else if (ts.Node.isIntersectionTypeNode(type)) {
      return <span>{Repeat(type.getTypeNodes(), typ => T(typ), ' & ')}</span>
    } else if (ts.Node.isTupleTypeNode(type)) {
      return <span>[{Repeat(type.getElementTypeNodes(), typ => T(typ), ', ')}]</span>
    } else if (ts.Node.isArrayTypeNode(type)) {
      return <span><Type type={type.getElementTypeNode()}/>[]</span>
    } else if (ts.Node.isParenthesizedTypeNode(type)) {
      return <span>(<Type type={type.getTypeNode()}/>)</span>
    } else if (ts.Node.isTypePredicateNode(type)) {
      return <span>{type.getParameterNameNode().getText()} is <Type type={type.getTypeNode()}/></span>
    } else if (ts.Node.isTypeReferenceNode(type)) {
      // THIS IS WHERE WE CREATE A LINK !
      return <span>{type.getTypeName().getText()}<TypeArgs ts={type.getTypeArguments()}/></span>
      // console.log(type.getType())
    } else if (ts.Node.isFunctionTypeNode(type)) {
      return <span>({Repeat(type.getParameters(), par => <ParamOrVar v={par}/>, ', ')}) => <Type type={type.getReturnTypeNode()}/></span>
    } else if (ts.Node.isConditionalTypeNode(type)) {
      return <span><Type type={type.getCheckType()}/> extends <Type type={type.getExtendsType()}/> ? <Type type={type.getTrueType()}/> : <Type type={type.getFalseType()}/></span>
      // console.log('!!!', type.getText())
    } else if (ts.Node.isInferTypeNode(type)) {
      return <span>infer {type.getTypeParameter().getName()}</span>
    } else if (ts.Node.isIndexedAccessTypeNode(type)) {
      return <span><Type type={type.getObjectTypeNode()}/>[<Type type={type.getIndexTypeNode()}/>]</span>
    } else if (
      ts.Node.isNumberKeyword(type) ||
      ts.Node.isTrueKeyword(type) ||
      ts.Node.isFalseKeyword(type) ||
      ts.Node.isInferKeyword(type) ||
      ts.Node.isBooleanKeyword(type) ||
      ts.Node.isSymbolKeyword(type) ||
      ts.Node.isObjectKeyword(type) ||
      ts.Node.isStringKeyword(type) ||
      ts.Node.isNeverKeyword(type) ||
      ts.Node.isNullLiteral(type) ||
      ts.Node.isUndefinedKeyword(type) ||
      ts.Node.isAnyKeyword(type) ||
      ts.Node.isLiteralTypeNode(type)
      // ts.Node.isTypeLiteralNode(type)
    ) {
      return <span>{type.getText()}</span>
    } else if (ts.Node.isTypeLiteralNode(type)) {
      var a = type.getMembers()
      for (var _ of a) {
        console.log(_.getText())
      }
      // console.log('WHAT NOW ?')

    }
  } else if (ts.Node.isExpression(type) || ['void', 'any', 'never'].includes(type.getText().trim())) {
    return <span>{type.getText()}</span>
  }

  // trying for edge cases not handled by ts-morph
  if (ts.ts.isMappedTypeNode(type.compilerNode)) {
    console.log('VICTORY !!!')
  } else if (ts.ts.isTypeOperatorNode(type.compilerNode)) {
    // FIXME we should PROBABLY go get the type of this expression and analyze it with the whole
    // getSymbol thing
    return <span>typeof {type.compilerNode.getChildAt(1).getText()}</span>
    // console.log('TYPEOF')
  }
  // var node = type.compilerNode

  console.log('NODE - ', type.constructor.name, type.compilerNode.constructor.name, type.getKindName(), type.getText())
  return <span class={css.error}>{type.getText()}</span>
}


export function TypeAlias({typ, name}: Attrs & {typ: ts.TypeAliasDeclaration, name: string}) {
  return <div class={css.kind_typealias}>
    <div class={css.name}>
      <span class={css.kind}>T</span>
    <b>{name}</b><TypeParams ts={typ.getTypeParameters()}/> = <Type type={typ.getTypeNode()}/></div>
  </div>
}


export function Interface(a: Attrs & {cls: ts.InterfaceDeclaration, name: string}) {
  return <div class={css.kind_interface}>
    <div class={css.name}>
      <span class={css.kind}>I</span>
    <b>{a.name}</b></div>
  </div>
}

export function Implements({impl}: Attrs & {impl: ts.ExpressionWithTypeArguments[]}) {
  return If(impl.length, () => <>implements {Repeat(impl, i => <><Type type={i.getType()}/><TypeArgs ts={i.getTypeArguments()}/></>, ', ')}</>)
}

export function Class(a: Attrs & {cls: ts.ClassDeclaration, name: string}) {
  return <div class={css.kind_class}>
    <div class={css.name}>
      <span class={css.kind}>C</span>
  <b>{a.name}</b> <Implements impl={a.cls.getImplements()}/></div>
  </div>
}


export function ParamOrVar({v, name}: Attrs & {v: ts.ParameterDeclaration | ts.VariableDeclaration, name?: string}) {
  // console.log('SYM', v.getSymbol()?.getTypeAtLocation(v.getSymbol()?.getValueDeclaration()!))
  function resolve() {
    var d = v.getSymbol()?.getTypeAtLocation(v.getSymbol()?.getValueDeclaration()!)
    return d
    // if (!d) return null
    // console.log('RESOLVIN', d.getText(), d.getSymbol()?.getDeclarations().map(d => d.constructor.name))
    return d
  }
  return <span><b>{name ?? v.getName()}</b>: <Type type={v.getTypeNode() ?? resolve() ?? v.getType()}/></span>
}

export function VarDecl({v, name}: Attrs & {v: ts.VariableDeclaration, name: string}) {
  var mod = 'const'
  const p = v.getParent()
  if (p instanceof ts.VariableDeclarationList && p.getText().startsWith('var')) {
    mod = 'var'
  }
  return <div class={css.kind_var}>
<div class={css.name}><span class={css.kind}>{mod}</span><ParamOrVar v={v} name={name}/></div>
  </div>
}

export function TypeParam({t}: Attrs & {t: ts.TypeParameterDeclaration}) {
  var ex = t.getConstraint()
  return <span>{t.getName()}{If(ex, ex => <> extends <Type type={ex}/></>)}</span>
}

export function TypeParams({ts}: Attrs & {ts: ts.TypeParameterDeclaration[]}) {
  return If(ts.length, () => <>&lt;{Repeat(ts, t => <TypeParam t={t}/>, ', ')}&gt;</>)
}
export function TypeArgs({ts}: Attrs & {ts: ts.TypeNode[]}) {
  return If(ts.length, () => <>&lt;{Repeat(ts, typ => <Type type={typ}/>, ', ')}&gt;</>)
}

export function FnProto(a: Attrs & {proto: ts.FunctionDeclaration, name: string}) {
  var fn = a.proto
  var docs = clean_comment(fn.getJsDocs().map(d => d.getText()).join('\n').trim())
  docs = md.render(docs)

  return <div class={css.kind_function}>
    <div class={css.name}>
      <span class={css.kind}>F</span>
      <b>{a.name}</b><TypeParams ts={fn.getTypeParameters()}/>({Repeat(fn.getParameters(), p => <ParamOrVar v={p}/>, ', ')}): <Type type={fn.getReturnTypeNode()! ?? fn.getReturnType()}/></div>
    <div class={css.doc}>{raw(docs)}</div>
  </div>
}