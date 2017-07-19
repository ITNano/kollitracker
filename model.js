var db = require('./db');
db.connect('localhost', 'kollitracker', 'CHANGE_THIS_TO_YOUR_PASSWORD', 'plocktracker');
var dateformat = require('dateformat');

exports.getLager = function(callback){
	db.query("SELECT id, name FROM lager", [], callback);
};

exports.addWorkday = function(uid, lager, date, startTime, endTime, breaks, callback){
	if(lager){
		db.query("INSERT INTO workday (id, user_id, lager_id, date, start, end) VALUES(NULL, ?, ?, ?, ?, ?)", [uid, lager, date, startTime, endTime], function(results){
			addBreaks(uid, date, breaks, callback);
		});
	}else{
		callback({error: true, msg: "You have to select ett lager"});
	}
};

function addBreaks(uid, date, breaks, callback){
	const cb = function(results){
		addBreaks(uid, date, breaks.splice(1), callback);
	};
	
	if(breaks.length > 0){
		db.query("INSERT INTO breaks (id, user_id, date, start, end) VALUES(NULL, ?, ?, ?, ?)", [uid, date, breaks[0].start, breaks[0].end], breaks.length>1?cb:callback);
	}else{
		callback();
	}
}

exports.addPlock = function(uid, lager, missions, rows, kolli, callback){
	if(!lager){
		lager = 2;
	}
	db.query("INSERT INTO plock (id, user_id, lager_id, stamp, missions, rows, kolli) VALUES(NULL, ?, ?, NULL, ?, ?, ?)", [uid, lager, missions, rows, kolli], callback);
};

exports.getCurrentStats = function(uid, lager, callback){
	if(!lager){
		lager = 2;
	}
	
	var data = {day:{}, week:{}};
	db.query("SELECT IFNULL(hours, 0) AS hours FROM workhours WHERE user_id = ? AND IsToday(date)", [uid], function(results){
		data["day"]["hours"] = getProperty(results, "hours");
		db.query("SELECT IFNULL(SUM(hours), 0) AS hours FROM workhours WHERE user_id = ? AND IsThisWeek(date)", [uid], function(results){
			data["week"]["hours"] = getProperty(results, "hours");
			db.query("SELECT IFNULL(kolli, 0) AS kolli FROM currentplock WHERE IsToday(date) AND user_id = ?", [uid], function(results){
				data["day"]["kolli"] = getProperty(results, "kolli");
				db.query("SELECT IFNULL(SUM(kolli), 0) AS kolli FROM currentplock WHERE IsThisWeek(date) AND user_id = ?", [uid], function(results){
					data["week"]["kolli"] = getProperty(results, "kolli");
					db.query("SELECT IFNULL(time, 0) AS time FROM dayprogress WHERE IsToday(date) AND user_id = ?", [uid], function(results){
						data["day"]["hoursPassed"] = getProperty(results, "time");
						db.query("SELECT IFNULL(SUM(time), 0) AS time FROM dayprogress WHERE IsThisWeek(date) AND user_id = ?", [uid], function(results){
							data["week"]["hoursPassed"] = getProperty(results, "time");
							processStats(data, callback);
						});
					});
				});
			});
		});
	});
};

function processStats(stats, callback){
	var SNITT = 152;
	var data = {day:{}, week:{}};
	stats["day"]["progress"] = {};
	stats["day"]["progress"]["kolli"] = safePercentCount(stats["day"]["kolli"], SNITT*stats["day"]["hours"]);
	stats["day"]["progress"]["time"] = safePercentCount(stats["day"]["hoursPassed"], stats["day"]["hours"]);
	stats["day"]["progress"]["extratime"] = Math.round((stats["day"]["kolli"]-SNITT*stats["day"]["hoursPassed"])/SNITT*60);
	stats["week"]["progress"] = {};
	stats["week"]["progress"]["kolli"] = safePercentCount(stats["week"]["kolli"], SNITT*stats["week"]["hours"]);
	stats["week"]["progress"]["time"] = safePercentCount(stats["week"]["hoursPassed"], stats["week"]["hours"]);
	stats["week"]["progress"]["extratime"] = Math.round((stats["week"]["kolli"]-SNITT*stats["week"]["hoursPassed"])/SNITT*60);
	callback(stats);
}

function getProperty(arr, prop){
	return arr.length > 0 ? arr[0][prop] : 0;
}

function safePercentCount(numerator, denominator){
	return denominator == 0 ? 0 : Math.round(numerator/denominator*100);
}