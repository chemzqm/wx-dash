const path = require('path')
const baseUrl = 'https://developers.weixin.qq.com/miniprogram/dev/'
const got = require('got')
const cheerio = require('cheerio')
const fs = require('fs')
const pify = require('pify')
const mkdirp = require('mkdirp')
const url = require('url')
const cpFile = require('cp-file')
const et = require('et-improve')
const tempFn = et.compileFile('./page.et')
const glob = require('glob')
const destDir = path.resolve(__dirname, 'wxapp.docset/Contents/Resources/Documents')
const Sequelize = require ('sequelize');
const del = require('del')

// 这些是函数, 但是官方文档没加 ()
const pageFunctions = ['onTabItemTap', 'onPullDownRefresh']
const ignorePattern = /^(参数|例子|定义|使用方法|示例代码|语法)/

async function downloadHtml() {
  let configs = [{
    dir: 'component',
    root: ''
  }, {
    dir: 'framework',
    root: 'MINA.html'
  }, {
    dir: 'api',
    root: ''
  }]
  for (let conf of configs) {
    let {dir, root} = conf
    let rootUrl = `${baseUrl}${dir}/${root}`
    let fileRoot = path.join(destDir, dir)
    let paths = []
    await pify(mkdirp)(fileRoot)
    let response = await got(rootUrl)
    const $ = cheerio.load(response.body, {decodeEntities: false})
    $('.summary li a').each((i, link) => {
      let href = $(link).attr('href').replace(/#.*$/, '')
      if (paths.indexOf(href) == -1) {
        paths.push(href)
      }
    })
    let title = $('title').text().replace(' · 小程序', '')
    $('.search-results').remove()
    let html = $('.page-inner').html()
    if (dir == 'api') {
      html = html.replace(/api\/intersection-observer\.md/g, 'intersection-observer.html')
    }
    let content = tempFn({
      title,
      path: '..',
      html
    })
    await pify(fs.writeFile)(path.join(fileRoot, root || 'index.html'), content, 'utf8')
    // download paths
    for (let p of paths) {
      if (/\/$/.test(p)) p = p + 'index.html'
      let remote = url.resolve(rootUrl, p)
      let base = path.dirname(path.resolve(fileRoot, p))
      await pify(mkdirp)(base)
      let s = /\.html/.test(p) ? p : `${p}.html`
      let file = path.resolve(fileRoot, s)
      let response = await got(remote)
      const $ = cheerio.load(response.body, {decodeEntities: false})
      let title = $('title').text().replace(' · 小程序', '')
      let len = p.split('/').length
      $('.search-results').remove()
      let content = tempFn({
        title,
        path: (new Array(len)).fill('..').join('/'),
        html: $('.page-inner').html()
      })
      await pify(fs.writeFile)(file, content, 'utf8')
      console.log(`Downloaded ${path.resolve(fileRoot, s)}`)
    }
  }
}

async function generateAPI(SearchIndex) {
  let files = await pify(glob)(`${destDir}/api/**/*.html`)
  let tags = ['h1', 'h2', 'h3', 'h4']
  for (let file of files) {
    let content = await pify(fs.readFile)(path.resolve(__dirname, file), 'utf8')
    const $ = cheerio.load(content, {decodeEntities: false})
    let title = $('title').text()
    let htmlPath = path.relative(destDir, file)
    for (let tag of tags) {
      for (let node of Array.from($(tag))) {
        let id = $(node).attr('id')
        let path = `${htmlPath}#${encodeURIComponent(id)}`
        let text = $(node).text()
        if (ignorePattern.test(id)) continue
        if (/^(api|tip|bug)$/i.test(id)
          || /--/.test(id)) {
          // Section
          let t = `${tag == 'h1' ? '' : title + ' · '}${text}`
          await SearchIndex.create({
            name: t,
            type: 'Section',
            path
          })
        } else if (text == 'restore' && /canvas/.test(file)) {
          await SearchIndex.create({
            name: 'canvasContext.restore',
            type: 'Method',
            path
          })
        } else if (text == 'Color' && /canvas/.test(file)) {
          // Section
          let t = `Canvas · Color`
          await SearchIndex.create({
            name: t,
            type: 'Section',
            path
          })
        } else if (/^[\w|-]+$/.test(id)) {
          if (/\./.test(text)) {
            // Method
            await SearchIndex.create({
              name: text.replace(/\(.*\)/, ''),
              type: 'Method',
              path
            })
          } else {
            if (/\(.*\)/.test(text) || pageFunctions.indexOf(text) !== -1) {
              await SearchIndex.create({
                name: `page.${text}`,
                type: 'Function',
                path
              })
            } else {
              // Object
              await SearchIndex.create({
                name: text,
                type: 'Object',
                path
              })
            }
          }
        } else {
          let t = `${tag == 'h1' ? '' : title + ' · '}${text}`
          await SearchIndex.create({
            name: t,
            type: 'Section',
            path
          })
        }
      }
    }
  }
}

async function generateComponent(SearchIndex) {
  let files = await pify(glob)(`${destDir}/component/**/*.html`)
  let tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  for (let file of files) {
    let content = await pify(fs.readFile)(path.resolve(__dirname, file), 'utf8')
    const $ = cheerio.load(content, {decodeEntities: false})
    let title = $('title').text()
    let htmlPath = path.relative(destDir, file)
    for (let tag of tags) {
      for (let node of Array.from($(tag))) {
        let id = $(node).attr('id')
        let path = `${htmlPath}#${encodeURIComponent(id)}`
        let text = $(node).text()
        if (tag == 'h4' && !/--/.test(id) && !/tips/i.test(id)) {
          await SearchIndex.create({
            name: text,
            type: 'Tag',
            path
          })
        } else {
          let t = `${tag == 'h1' ? '' : title + ' · '}${text}`
          await SearchIndex.create({
            name: t,
            type: 'Section',
            path
          })
        }
      }
    }
    // parse attributes
    let tables = Array.from($('table'))
    for (let table of tables) {
      let th = $(table).find('thead th:first-child')
      if (th.text() == '属性名') {
        let tds = Array.from($(table).find('tr > td:first-child'))
        for (let td of tds) {
          let name =  $(td).text()
          let id = `${title}-${name}`
          $(td).attr('id', id)
          let path = `${htmlPath}#${encodeURIComponent(id)}`
          await SearchIndex.create({
            name,
            type: 'Attribute',
            path
          })
        }
      }
    }
    await pify(fs.writeFile)(file, $.html(), 'utf8')
  }
}

async function loadFrameworkNavigation() {
  let response = await got('https://developers.weixin.qq.com/miniprogram/dev/framework/config.html')
  const $ = cheerio.load(response.body, {decodeEntities: false})
  let root = $('ul.summary')
  let items = []
  traverseRoot($, root, '', (path, name) => {
    let p = /\/$/.test(path) ? `${path}index.html` : path
    items.push(`${p}|${name.trim()}`)
  })
  await pify(fs.writeFile)('framework.txt', items.join('\n'), 'utf8')
}

function traverseRoot($, root, base, fn) {
  let lis = root.children('li')
  lis.each((idx, li) => {
    let name = $(li).data('name')
    let path = $(li).data('path')
    fn(path, `${base} ${name}`)
    let ul = $(li).children('ul')
    if (ul.length) {
      traverseRoot($, ul, `${base} ${name}`, fn)
    }
  })
}

async function generateFramework(SearchIndex) {
  let files = await pify(glob)(`${destDir}/framework/**/*.html`)
  let navigations = await pify(fs.readFile)('./framework.txt', 'utf8')
  let config = {}
  navigations.split(/\n/).forEach(o => {
    let parts = o.split('|')
    config[parts[0]] = parts[1]
  })
  for (let file of files) {
    let content = await pify(fs.readFile)(path.resolve(__dirname, file), 'utf8')
    const $ = cheerio.load(content, {decodeEntities: false})
    let htmlPath = path.relative(destDir, file)
    let title = config[htmlPath.replace(/^framework\//, '')]
    if (title) {
      await SearchIndex.create({
        name: title,
        type: 'Guide',
        path: htmlPath
      })
    } else {
      let title = $('title').text()
      await SearchIndex.create({
        name: title,
        type: 'Guide',
        path: htmlPath
      })
    }
  }
}

async function start() {
  await pify(mkdirp)(destDir)
  await cpFile('icon.png', path.resolve(destDir, '../../../icon.png'))
  await cpFile('info.plist', path.resolve(destDir, '../../info.plist'))
  await cpFile('style.css', path.join(destDir, 'style.css'))
  await cpFile('website.css', path.join(destDir, 'website.css'))
  await downloadHtml()
  await loadFrameworkNavigation()
  const dbFile = path.resolve(destDir, '../docSet.dsidx')
  await del([dbFile])
  const seq = new Sequelize('database', 'username', 'password', {
    dialect: 'sqlite',
    operatorsAliases: false,
    // SQLite only
    storage: dbFile,
    logging: false
  })
  await seq.authenticate()
  const SearchIndex = seq.define('searchIndex', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: Sequelize.STRING
    },
    type: {
      type: Sequelize.STRING
    },
    path: {
      type: Sequelize.STRING
    }
  }, {
    freezeTableName: true,
    timestamps: false
  });
  await SearchIndex.sync({force: true})
  await generateAPI(SearchIndex)
  await generateComponent(SearchIndex)
  await generateFramework(SearchIndex)
}

start()
