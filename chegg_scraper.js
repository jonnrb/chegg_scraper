const fs = require('fs')
    , http = require('http')
    , path = require('path')
    , readline = require('readline')
    , url = require('url')



// the javascript pill is run by the target web application and coordinates
// sending data to the collector.

let pill_code = ''
  , resume_setting = false
  , has_problem_text_setting = false

function load_pill () {
  pill_code = fs.readFileSync('./pill.js').toString()
}

function render_pill () {
  let rendered = pill_code
  .replace('{{ resume_setting }}', resume_setting)
  .replace('{{ has_problem_text_setting }}', has_problem_text_setting)
  resume_setting = true
  return rendered
}

load_pill()



// here we keep a db of all the chapters and their problems collected so far.

let chapters = {}
function add_data (data) {

  if (!data.chapter_title) {
    console.warn('Missing chapter_title in', data)
    return
  } else if (!data.title) {
    console.warn('Missing title in', data)
    return
  }

  console.log('Got', data.title)

  if (chapters[data.chapter_title] === undefined) {
    chapters[data.chapter_title] = {
        new_data: undefined
      , items: []
      , title: data.chapter_title
      }
  }

  chapters[data.chapter_title].items.push(data)
  chapters[data.chapter_title].new_data = true

}



// these utilities save

let target_folder_name

function render_chapter (chapter_data) {

  // some links on the chegg pages start with "//" which works fine on an
  // http(s) scheme, but on a file scheme is not so great.
  let fix_links = t => t.replace(/\"\/\//g, '\"http://')

  let d = `<!doctype html>
<meta charset='utf-8'>

<h1>${chapter_data.title}</h1>

`

  for (let x of chapter_data.items) {
    d += `<h2>${x.title}</h2>
`
    if (x.problem) {
      d += `<h3>Problem</h3>
${fix_links(x.problem)}`
    }

    d += `<h3>Solution</h3>
${fix_links(x.solution)}
<br/>`
  }

  return d

}

function save_chapters (callback) {

  let tasks_size = 0

  let done_with_task = callback ? () => {
    tasks_size--
    if (tasks_size === 0) {
      callback()
    }
  } : () => {}

  for (let chapter_title in chapters) {
    let chapter_data = chapters[chapter_title]

    if (!chapter_data.new_data) continue

    tasks_size++

    console.log('Saving', chapter_title)

    chapter_data.new_data = false

    fs.writeFile(path.join(target_folder_name, `${chapter_title}.html`),
                 render_chapter(chapter_data), done_with_task)

  }

}



function start_stuff () {

  // create an http server (collector).
  let listen_port = 8080
  http.createServer().listen(listen_port, function () {

    if (listen_port === 0) listen_port = this.address().port

    this.on('request', (request, response) => {

      request.url = url.parse(request.url)

      if (request.url.pathname === '/pill') {
        response.writeHead(200, {'Access-Control-Allow-Origin': '*'})
        response.end(render_pill())
        return
      } else if (request.url.pathname !== '/') {
        response.writeHead(404)
        response.end()
        return
      }

      let message = ''
      request.on('data', data=>(message+=data))
      request.on('end', () => {
        add_data(JSON.parse(message))
        response.writeHead(200, {'Access-Control-Allow-Origin': '*'})
        response.end()
      })

    })

    console.log(`
http server listening
(we're ready to go)

1. go to your chegg book over an http connection (no green "secure" icon)
   if your browser shows a secure connection, edit the address (https -> http)
2. click on the address bar and type 'javascript:'
3. paste in this -> $.getScript('http://localhost:${listen_port}/pill
4. hit enter

if chegg gets stuck loading:
1. copy the url from your browser bar
2. close the tab
3. open a new tab and paste and go
4. start from step 2 in the first part
`)

  })

}



const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

let rl_q = (question, answer_cb) => () => {
  return new Promise((resolve, reject) => {
    rl.question(question, answer => {
      answer_cb(answer)
      resolve()
    })
  })
}

Promise.resolve()
.then(rl_q(`what's the name of the book we'll be scraping today?\n> `,
      answer => {

  console.log(`thank you for your valuable input. we will be making a folder ` +
              `called '${answer}' where we'll save the chegg stuff while `     +
              `it's being downloaded. we'll also put the html there at the end`)

  target_folder_name = answer

  try {
    fs.mkdirSync(target_folder_name)
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err
    }
  }

}))
.then(rl_q(`do the answers on chegg show the problem text before the ` +
           `solutions (yes/no)?\n> `, answer => {

  if (answer === 'yes') {
    has_problem_text_setting = true
  } else if (answer === 'no') {
    has_problem_text_setting = false
  } else {
    throw 'bad answer!'
  }

}))
.then(() => {

  setInterval(save_chapters, 15000)

  start_stuff()

})
.catch(err => {
  if (err) {
    console.log(err)
    process.exit()
  }
})
