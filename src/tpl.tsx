import { s, raw, If, Component, Child, STSXNode } from 'stsx'
import { MapArray } from './documentable';

export type BlockInstantiator<T> = {new (...a: any[]): Block<T>, children: Child[]}
const block_children_map = new MapArray<BlockInstantiator<any>, Child[]>()

export class Block<A> extends Component<A> {

  static children = [] as Child[][]

  mount(node: STSXNode) {
    const t = node.query(Template)
    if (!t) return
    // look in blocks and register itself. the last one to speak is usually
    // the first one defined.
  }

  render(ch: Child[]) {
    block_children_map.add(this.constructor as any, ch)
    return <></>
  }

}


export class DisplayBlock extends Component<{
  block: {new (a: any): Block<any>}
  concatenate?: boolean
}> {
  render() {
    const cons = this.attrs.block as any
    const children = block_children_map.get(cons)
    if (!children) return <></>

    block_children_map.set(cons, [])
    if (this.attrs.concatenate)
      return <>{children}</>
    return <>{children[0]}</>
  }
}

export class MoreHead extends Block<{}> { }
export class MoreBody extends Block<{}> { }
export class TestBlock extends Block<{}> { }

export class Template extends Component<{
  title?: string
  lang?: string
  description?: string
}> {

  render(ch: Child[]) {
    return <>{raw(`<!doctype html>`)}
      <html lang={this.attrs.lang ?? 'en'}>
        <head>
          <title>{this.attrs.title ?? 'TITLE MISSING'}</title>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <link rel="stylesheet" href="./main.css"/>
          <link rel="stylesheet" href="./css/all.min.css"/>
          {If(this.attrs.description, desc => <meta name='description' content={desc}/>)}
          <DisplayBlock block={MoreHead} concatenate/>
        </head>
        <body>
          {ch}
          <DisplayBlock block={MoreBody} concatenate/>

          <DisplayBlock block={TestBlock}></DisplayBlock>
        </body>
      </html>
    </>
  }
}

function TplWithToc() {
  return <Template title='Base title'>
    <MoreHead>
      <link/>
    </MoreHead>
  </Template>
}
// console.log(<TplWithToc/>)

/*
export class Base extends Part {
  title = 'Base title'

  description?: string
  lang?: string

  Main = () => <>
      {raw(`<!doctype html>`)}
      <html lang={this.lang}>
        <head>
          <title>{this.title}</title>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <link rel="stylesheet" href="./main.css"/>
          <link rel="stylesheet" href="./css/all.min.css"/>
          {If(this.description, desc => <meta name='description' content={desc}/>)}

          {this.head.map(h => h())}
        </head>
        <body>
          {this.body.map(b => b())}
        </body>
      </html>
    </>

  // ga = this.use(Ga, {key: 'UA-947732-15'})

}


export class Toc extends Part {
  base = this.use(Base)
}
*/
// var b = new Base()
//   .setPart(Ga, {key: 'UA-348383-1'})
// console.log(b.get(Base).Main())//.render(process.stdout)
// console.log(<a>toto</a>)
