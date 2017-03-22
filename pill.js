(function(){

const RESUME = {{ resume_setting }}
    , HAS_PROBLEM_TEXT = {{ has_problem_text_setting }}

let found_spot = false

if (document.querySelector('.toggle-button-toolbar.selected') === null) {
  document.querySelector('.toggle-button-toolbar').click();
}

let get_problem_html = () => {
      let e = document.querySelector('.problem-content')
      return e ? e.innerHTML : null
    }
  , get_solution_html = () => {
      let e = document.querySelectorAll('.solution>ol.steps>li>section>div.content')
      return (e.length > 0
        ? '<ol>' + Array.prototype.map.call(e, x => ('<li>' + x.innerHTML + '</li>')).join('') + '</ol>'
        : null)
    }
  , get_title = () => {
      let e = document.querySelector('.toolbar>.title')
      return e ? e.innerHTML : null
    }

let prev_title
  , prev_problem_html
  , prev_solution_html

let root_chain = Promise.resolve()

for (let chapter of document.querySelectorAll('.chapters>.chapter')) {

  root_chain = root_chain.then(() => {
    return new Promise((resolve, reject) => {

      let problem_chain = Promise.resolve()
        , chapter_title = chapter.querySelector('h2').innerText

      if (!chapter.classList.contains('open')) {
        chapter.querySelector('h2').click()
      }

      if (!RESUME || found_spot) {
        console.warn('Scraping', chapter_title)
      }

      for (let problem of chapter.querySelectorAll('ol.problems>li.problem')) {
        problem_chain = problem_chain.then(() => {
          return new Promise((resolve, reject) => {

            if (RESUME && !found_spot) {
              if (problem.classList.contains('current')) {
                found_spot = true
                console.log('RESUMING FROM HERE')
              } else {
                resolve()
                return
              }
            }

            console.warn(problem)

            problem.click()

            function send_answer () {

              let title = get_title()
                , problem = get_problem_html()
                , solution = get_solution_html()

              if (!title || (!problem && HAS_PROBLEM_TEXT) || !solution ||
                  title == prev_title ||
                  (HAS_PROBLEM_TEXT && problem == prev_problem_html) ||
                  solution == prev_solution_html) {
                setTimeout(send_answer, 250)
                return
              }

              let data = {
                  chapter_title: chapter_title
                , title: title
                , solution: solution
                }

              if (HAS_PROBLEM_TEXT) data.problem = problem

              $.post('http://localhost:8080', JSON.stringify(data), () => {}, 'json')

              prev_title = title
              prev_problem_html = problem
              prev_solution_html = solution

              setTimeout(() => resolve(), 500)

            }

            setTimeout(send_answer, 3000)

          })
        })
      }

      problem_chain.catch(err => reject(err)).then(() => {
        console.warn('Done scraping', chapter_title)
        resolve()
      })

    })
  })
}

root_chain.then(() => {
  console.log('DONE')
})

})()
