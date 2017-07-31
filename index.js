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
app.get('/logout', function(req, res, next){
	res.clearCookie('uid');
	res.redirect('/login');
});

app.use(function(req, res, next){
	if(!req.cookies.uid && !req.body.uid){
		res.redirect('/login');
	}else{
		next();
	}
});

app.get('/', function(req, res, next){
	if(req.query.lager){
		res.cookie('lager', req.query.lager);
	}
	model.getLager(function(lager){
		model.getCurrentStats(req.cookies.uid, getActiveLager(req), function(results){
			res.render('pages/main', {title: 'Main stats', uid:req.cookies.uid, stats: results, lager: lager, selectedLager: getActiveLager(req)});
		});
	});
});
app.post('/', function(req, res, next){
	model.addPlock(req.cookies.uid, getActiveLager(req), req.body.uppdrag, req.body.rader, req.body.kollin, function(results){
		passMessage(req, results.error, results.msg, "Registered plock");
		res.redirect('/');
	});
});
app.get('/addwork', function(req, res, next){
	model.getLager(function(results){
		model.getWorkShifts(req.cookies.uid, function(shifts){
			res.render('pages/addwork', {title: 'Add work day to user', today: dateformat(new Date(), "yyyy-mm-dd"), lager: results, workshifts: shifts});
		});
	});
});
app.post('/addwork', function(req, res, next){
	var lager = req.body.lager ? req.body.lager : 2;
	var times = {day:[[{lager: 2, start:"06:30:00", end:"10:45:00", breaks:[{start:"08:30:00", end:"08:45:00"}]}, {lager: 1, start:"10:45:00", end:"15:15:00", breaks:[{start: "12:35:00", end: "13:05:00"}]}],
					  [{lager: 2, start:"06:30:00", end: "15:15:00", breaks: [{start: "08:30:00", end: "08:45:00"}, {start: "12:35:00", end: "13:05:00"}]}]],
				middle:[[{lager: 1, start:"10:45:00", end: "15:15:00", breaks: [{start: "12:35:00", end: "13:05:00"}]}, {lager: 2, start:"15:15:00", end:"18:45:00", breaks:[{start:"15:15:00", end:"15:30:00"}]}],
						[{lager: 2, start:"10:45:00", end: "18:45:00", breaks: [{start: "12:35:00", end: "13:05:00"}, {start: "15:15:00", end: "15:30:00"}]}]],
				night: [[],
					   [{start: "15:15:00", end: "23:15:00", breaks: [{start: "18:45:00", end: "19:15:00"}]}]]};
	var shifts = times[req.body.pass][lager-1];
	model.addWorkday(req.cookies.uid, req.body.date, shifts, function(results){
		passMessage(req, results.error, results.msg, "Added day to user");
		res.redirect('/addwork');
	});
});
app.post('/removework', function(req, res, next){
	if(req.body.removeid){
		model.removeWorkday(req.cookies.uid, req.body.removeid, function(results){
			passMessage(req, results.error, results.msg, "Removed day from user");
			res.redirect('/addwork');
		});
	}
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

function getActiveLager(req){
	return req.query.lager ? req.query.lager : (req.cookies.lager ? req.cookies.lager : 2);
}