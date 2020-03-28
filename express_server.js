const createError = require('http-errors')
const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const logger = require('morgan')
const favicon = require('serve-favicon')
const indexRouter = require('./routes/index')
const hallsRouter = require('./routes/halls')
const hallRouter = require('./routes/hall')

const app = express()

// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')
app.use(favicon(path.join(__dirname, 'public/img', 'favicon.ico')))

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser('sing-out-live'))
app.use(express.static(path.join(__dirname, 'public')))

app.use((req, res, next) => {
  /* adorn results objects  */
  res.locals.userName = req.signedCookies.userName || ''
  res.locals.rooms = global.rooms
  res.locals.wss = global.wss
  next()
})

app.use('/', indexRouter)
app.use('/halls', hallsRouter)
app.use('/hall', hallRouter)

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404))
})

app.use(function (err, req, res, next) {
  res.locals.message = err.message
  res.locals.error =
    req.app.get('env') === 'development' ? err : {}

  if (req.accepts('html')) {
    res
      .status(err.status || 500)
      .render('error')
  } else if (req.accepts('json')) {
    res
      .status(err.status)
      .json({
        status: err.status,
        name: err.name,
        message: err.message
      })
  } else {
    res
      .status(err.status)
      .send(`${err.status}: ${err.message}\r\n`)
  }
})

module.exports = app
