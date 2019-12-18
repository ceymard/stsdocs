import * as ts from 'ts-morph'
import { Attrs, s, raw, If, Repeat, Child } from 'stsx';
import css from './css'
import { VariableTypes, Documentable, hasModifiers } from './documentable';


function T(typ: ts.TypeNode | ts.Type | ts.Expression | undefined | null) {
  return <Type type={typ}/>
}


export function Type({type}: Attrs & {type: ts.TypeNode | ts.Type | ts.Expression | undefined | null}) {
  if (!type) return raw('')
  if (type instanceof ts.Type) {
    var txt = type.getText()

    if (type.isLiteral()
      || type.isAny()
      || type.isNull()
      || type.isBoolean()
      || type.isUndefined()
      || type.isNumber()
      || type.isString()
      || type.isUnknown()
      || ['void'].includes(txt)
    ) {
      return <span>{txt}</span>
    } else if (type.isUnion()) {
      return <span>{Repeat(type.getUnionTypes(), typ => T(typ), ' | ')}</span>
    } else if (type.isTuple()) {
      return <span>[{Repeat(type.getTupleElements(), typ => T(typ), ', ')}]</span>
    } else if (type.isIntersection()) {
      return <span>{Repeat(type.getIntersectionTypes(), typ => T(typ), ' & ')}</span>
    } else if (type.getArrayElementType()) {
      // console.log(type.getText())
      // console.log(type.getArrayElementType()?.getText())
      // FIXME why does the following throw a max call stack size exceeded ????
      // return <span><Type type={type.getArrayElementType()}/>[]</span>
      return <span>{type.getArrayElementType()?.getText().replace(/import\("[^"]*"\)\./g, '')}[]</span>
      // console.log('!@#!@#!@#')
    } else if ('indexType' in type.compilerType) {
      // const t2 = type.
      const ot = type as any
      const t = type.compilerType as any
      // console.dir(t, {depth: 0})
      const idx = new (ts.Type as any)(ot._context, t.indexType)
      const obj = new (ts.Type as any)(ot._context, t.objectType)
      return <span><Type type={obj}/>[<Type type={idx}/>]</span>
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
        // console.log(ta.map(a => a.constructor.name))
        // ta = ta.slice(0, -1) // apparently, they always include this as the last parameter.
        // THERE IS A LINK HERE AS WELL !
        return <span><a href={'#' + (Documentable.name_map.get(first) ?? first.getName())}>{first.getName()}</a>{ta.length ? <>&lt;{Repeat(ta, a => T(a), ', ')}&gt;</> : ''}</span>
      }

      // FIXME
      // return <span>INFER ANON {type.getText()} [{decls.map(d => d.constructor.name)}]</span>
      return <span>{txt.replace(/import\("[^"]*"\)\./g, '')}</span>
    }

    // console.dir(type.compilerType, {depth: 0})
    console.log('TYPE NOT FOUND - ', type.constructor.name, type.compilerType.constructor.name, type.getText())
    return <span>{txt}</span>

  } else if (type instanceof ts.TypeNode) {

    if (ts.Node.isUnionTypeNode(type)) {
      return <span class={css.type}>{Repeat(type.getTypeNodes(), typ => T(typ), ' | ')}</span>
    } else if (ts.Node.isIntersectionTypeNode(type)) {
      return <span class={css.type}>{Repeat(type.getTypeNodes(), typ => T(typ), ' & ')}</span>
    } else if (ts.Node.isTupleTypeNode(type)) {
      return <span class={css.type}>[{Repeat(type.getElementTypeNodes(), typ => T(typ), ', ')}]</span>
    } else if (ts.Node.isArrayTypeNode(type)) {
      return <span><Type type={type.getElementTypeNode()}/>[]</span>
    } else if (ts.Node.isParenthesizedTypeNode(type)) {
      return <span>(<Type type={type.getTypeNode()}/>)</span>
    } else if (ts.Node.isTypePredicateNode(type)) {
      return <span class={css.type}>{type.getParameterNameNode().getText()} is <Type type={type.getTypeNode()}/></span>
    } else if (ts.Node.isTypeReferenceNode(type)) {
      // THIS IS WHERE WE CREATE A LINK !
      var resolved = type.getType().getSymbol()?.getDeclarations()[0] ?? type.getType().getSymbol()?.getValueDeclaration()
      var typename = type.getTypeName().getText()
      return <a href={`#${Documentable.name_map.get(resolved!) ?? typename}`}>{typename}<TypeArgs ts={type.getTypeArguments()}/></a>
      // console.log(type.getType())
    } else if (ts.Node.isFunctionTypeNode(type)) {
      return <span class={css.type}>({Repeat(type.getParameters(), par => <ParamOrVar v={par}/>, ', ')}) => <Type type={type.getReturnTypeNode()}/></span>
    } else if (ts.Node.isConditionalTypeNode(type)) {
      return <span class={css.type}><Type type={type.getCheckType()}/> extends <Type type={type.getExtendsType()}/> ? <Type type={type.getTrueType()}/> : <Type type={type.getFalseType()}/></span>
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
      // type.getIndexSignatures()
    return <span class={css.type}>{'{'} {Repeat(type.getIndexSignatures(), sig => <>[<Type type={sig.getKeyTypeNode()}/>]: <Type type={sig.getReturnTypeNode()}/></>, ', ')} {Repeat(type.getProperties(), p => <>{p.getName()}{p.getQuestionTokenNode() ? '?' : ''}: <Type type={p.getTypeNode()}/></>, ', ')} {'}'}</span>
    }
  } else if (ts.Node.isExpression(type) || ['void', 'any', 'never'].includes((type as any).getText().trim())) {
    return <span>{type.getText()}</span>
  }

  // trying for edge cases not handled by ts-morph
  if (ts.ts.isMappedTypeNode(type.compilerNode)) {
    // console.dir(type, {depth: 0 })
    const chlds = type.getChildren()
    const has_quest = type.getChildrenOfKind(ts.ts.SyntaxKind.QuestionToken).length > 0

    const param: ts.TypeParameterDeclaration = chlds[2] as any
    const t: ts.TypeNode = chlds[chlds.length - 2] as any

    return <span>{'{'}[<TypeParam t={param}/>]{has_quest ? '?' : ''}: <Type type={t}/>{'}'}</span>
  } else if (ts.ts.isTypeOperatorNode(type.compilerNode)) {
    // FIXME we should PROBABLY go get the type of this expression and analyze it with the whole
    // getSymbol thing
    return <span>typeof {type.compilerNode.getChildAt(1).getText()}</span>
  }
  // var node = type.compilerNode

  console.log('NODE - ', type.constructor.name, type.compilerNode.constructor.name, type.getKindName(), type.getText())
  return <span class={css.error}>{type.getText()}</span>
}


export function TypeAlias({typ, name}: Attrs & {typ: ts.TypeAliasDeclaration, name: string}) {
  return <DocBlock class={css.kind_typealias} name={name} kind='T'>
    <TypeParams ts={typ.getTypeParameters()}/> = <Type type={typ.getTypeNode()}/>
  </DocBlock>
}


export function Interface(a: Attrs & {cls: ts.InterfaceDeclaration, name: string}) {
  return <DocBlock class={css.kind_interface} name={a.name} kind='I'>
    <TypeParams ts={a.cls.getTypeParameters()}/><ExpressionWithTypeArguments keyword=' extends' impl={a.cls.getExtends()}/>
  </DocBlock>
}

export function ExpressionWithTypeArguments({impl, keyword}: Attrs & {impl: ts.ExpressionWithTypeArguments[] | ts.ExpressionWithTypeArguments | undefined, keyword: string}) {
  if (!impl) return <></>
  if (!Array.isArray(impl)) impl = [impl]
  var _impl = impl as ts.ExpressionWithTypeArguments[]
  return If(_impl.length, () => <>{keyword} {Repeat(_impl, i => <Type type={i.getType()}/>, ', ')}</>)
}

export function Kind(a: Attrs, ch: Child) {
  if (!ch) return <></>
  return <span class={css.kind}>{ch}</span>
}

export function Class(a: Attrs & {cls: ts.ClassDeclaration, name: string}) {
  return <DocBlock class={css.kind_class} name={a.name} kind='C'>
    <TypeParams ts={a.cls.getTypeParameters()}/> <ExpressionWithTypeArguments keyword='extends' impl={a.cls.getExtends()}/> <ExpressionWithTypeArguments impl={a.cls.getImplements()} keyword='implements'/>
  </DocBlock>
}


function resolve_type(v: ts.ParameterDeclaration | VariableTypes) {
  return v?.getTypeNode() ?? v.getSymbol()?.getTypeAtLocation(v.getSymbol()?.getValueDeclaration()!) ?? v.getType()
}


export function ParamOrVar({v, name}: Attrs & {v: ts.ParameterDeclaration | VariableTypes, name?: string}) {
  return <span><b>{name ?? v.getName()}</b>: <Type type={resolve_type(v)}/></span>
}

export function VarDecl({v, name}: Attrs & {v: VariableTypes, name: string, kind?: string}) {
  var mod = 'const'
  const p = v.getParent()
  if (p instanceof ts.VariableDeclarationList && p.getText().startsWith('var')) {
    mod = 'var'
  } else if (v instanceof ts.PropertyDeclaration || v instanceof ts.PropertySignature) {
    mod = ''
  }

  // If this is a const function, output it as a function.
  if (mod === 'const') {
    var resolved = resolve_type(v)
    // console.log(name, resolved.constructor.name)
    if (resolved instanceof ts.FunctionTypeNode)
      return <FnProto name={name} proto={resolved}/>
  }

  return <div class={css.kind_var}>
    <div class={css.name}><span class={css.kind}>{mod}</span><ParamOrVar v={v} name={name}/></div>
  </div>
}

export function TypeParam({t}: Attrs & {t: ts.TypeParameterDeclaration}) {
  var ex = t.getConstraint()
  var kind = t.getChildrenOfKind(ts.ts.SyntaxKind.InKeyword).length > 0 ? 'in' :
    t.getChildrenOfKind(ts.ts.SyntaxKind.OfKeyword).length > 0 ? 'of' :
    'extends'
  return <span>{t.getName()}{If(ex, ex => <> {kind} <Type type={ex}/></>)}</span>
}

export function TypeParams({ts}: Attrs & {ts: ts.TypeParameterDeclaration[]}) {
  return If(ts.length, () => <>&lt;{Repeat(ts, t => <TypeParam t={t}/>, ', ')}&gt;</>)
}
export function TypeArgs({ts}: Attrs & {ts: ts.TypeNode[]}) {
  return If(ts.length > 0, () => <>&lt;{Repeat(ts, typ => <Type type={typ}/>, ', ')}&gt;</>)
}


export function FnProto(a: Attrs & {proto: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ConstructorDeclaration | ts.ConstructSignatureDeclaration | ts.MethodSignature | ts.CallSignatureDeclaration | ts.FunctionTypeNode, name: string, kind?: string}) {
  var fn = a.proto
  var mods = hasModifiers(a.proto) ? ' ' + a.proto.getModifiers().map(m => m.getText()).join(' ') + ' ' : ''

  return <DocBlock class={css.kind_function} kind={a.kind} name={mods + a.name}><TypeParams ts={fn.getTypeParameters()}/>({Repeat(fn.getParameters(), p => <ParamOrVar v={p}/>, ', ')}): <Type type={fn.getReturnTypeNode()! ?? fn.getReturnType()}/>
  </DocBlock>
}


export function DocBlock(a: Attrs & {name: string, kind?: string}, ch: Child[]) {
  return <div class={css.name}>
      {If(a.kind, k => <span class={css.kind}>{k}</span>)}
      <b>{a.name}</b>{ch}
  </div>
}
