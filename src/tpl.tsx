import { s, raw, If, Child, create_block, EmptyAttributes } from 'stsx'


export const MoreHead = create_block('more head', true)
export const MoreBody = create_block('more body', true)

export function Template(a: {
  title?: string
  lang?: string
  description?: string
} & EmptyAttributes, ch: Child[]) {

  return <>{raw(`<!doctype html>`)}
    <html lang={a.lang ?? 'en'}>
      <head>
        <title>{a.title ?? 'TITLE MISSING'}</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <link rel="stylesheet" href='./normalize.css'/>
        <link rel="stylesheet" href="./main.css"/>
        {If(a.description, desc => <meta name='description' content={desc}/>)}
        <MoreHead.Display/>
      </head>
      <body>
        {ch}
        <MoreBody.Display/>
      </body>
    </html>
  </>
}

