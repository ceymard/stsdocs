import { s, raw, If, Component, Child, create_block } from 'stsx'


export const MoreHead = create_block('more head', true)
export const MoreBody = create_block('more body', true)

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
          <link rel="stylesheet" href='./normalize.css'/>
          <link rel="stylesheet" href="./main.css"/>
          {If(this.attrs.description, desc => <meta name='description' content={desc}/>)}
          <MoreHead.Display/>
        </head>
        <body>
          {ch}
          <MoreBody.Display/>
        </body>
      </html>
    </>
  }
}
