var express = require('express'), http = require('http');
var app = express();
var httpServer = http.createServer(app);

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

var multer = require('multer');
var upload = multer({ dest:'public/uploads/' });
app.use(upload.any());

var flash = require('express-flash'), cookieParser = require('cookie-parser'), session = require('express-session');
app.use(cookieParser('keyboard cat'));
app.use(session({ cookie: { maxAge: 60000 }}));
app.use(flash());

app.use(express.static('public'));
app.set('view engine', 'ejs');

var model = require('./model'), dateformat = require("dateformat");

app.get('/', function(req, res, next){
	if(!req.cookies.uid){
		res.redirect('/login');
	}else{
		model.getLager(function(lager){
			model.getCurrentStats(req.cookies.uid, req.query.lager, function(results){
				res.render('pages/main', {title: 'Main stats', uid:req.cookies.uid, stats: results, lager: lager, selectedLager: req.query.lager ? req.query.lager : 2});
			});
		});
	}
});
app.post('/', function(req, res, next){
	model.addPlock(req.cookies.uid, req.query.lager, req.body.uppdrag, req.body.rader, req.body.kollin, function(results){
		passMessage(req, results.error, results.msg, "Registered plock");
		res.redirect('/');
	});
});
app.get('/addwork', function(req, res, next){
	model.getLager(function(results){
		res.render('pages/addwork', {title: 'Add work day to user', today: dateformat(new Date(), "yyyy-mm-dd"), lager: results});
	});
});
app.post('/addwork', function(req, res, next){
	var times = {day:{start:"06:30:00", end: "15:15:00", breaks: [{start: "08:30:00", end: "08:45:00"}, {start: "12:35:00", end: "13:05:00"}]}, middle: {start:"10:45:00", end: "18:45:00", breaks: [{start: "12:35:00", end: "13:05:00"}, {start: "15:15:00", end: "15:30:00"}]}, night: {start: "15:15:00", end: "23:15:00", breaks: [{start: "18:45:00", end: "19:15:00"}]}};
	var time = times[req.body.pass];
	model.addWorkday(req.cookies.uid, req.body.lager, req.body.date, time.start, time.end, time.breaks, function(results){
		passMessage(req, results.error, results.msg, "Added day to user");
		res.redirect('/addwork');
	});
});
app.get('/logout', function(req, res, next){
	res.clearCookie('uid');
	res.redirect('/login');
});

app.get('/login', function(req, res, next){
	res.render('pages/login', {title: 'Login'});
});
app.post('/login', function(req, res, next){
	if(req.body.uid || req.body.uid.length == 0){
		res.cookie('uid', req.body.uid);
		res.redirect('/');
	}else{
		req.flash('error', 'No username supplied');
		res.redirect('/login');
	}
});

httpServer.listen(1340, function(){
	console.log("Server running at port %s", httpServer.address().port)
});


function passMessage(req, error, onError, onSuccess){
	if(error) req.flash('error', onError);
	else req.flash('msg', onSuccess);
}