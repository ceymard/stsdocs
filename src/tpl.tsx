import { s, raw, If, Part } from 'stsx'

class Ga extends Part {
  key = ''

  base = this.use(Base) as Base

  init() {
    this.body.push(() => If(this.key, () => <>
      {raw(`<!-- Google Analytics -->`)}
      <script>
        {raw(`(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
        (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
        m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
        })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');`)}

        ga('create', '{this.key}', 'auto');
        ga('send', 'pageview');
      </script>
      {raw(`<!-- End Google Analytics -->`)}
    </>))
  }
}


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

// var b = new Base()
//   .setPart(Ga, {key: 'UA-348383-1'})
// console.log(b.get(Base).Main())//.render(process.stdout)
// console.log(<a>toto</a>)
