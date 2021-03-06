var db = require('./db');
db.connect('localhost', 'kollitracker', 'CHANGE_THIS_TO_YOUR_PASSWORD', 'plocktracker');
var dateformat = require('dateformat');

exports.getLager = function(callback){
	db.query("SELECT id, name FROM lager", [], callback);
};

exports.addWorkday = function(uid, date, shifts, callback){
	const cb = function(results){
		exports.addWorkday(uid, date, shifts.splice(1), callback);
	};
	if(shifts.length > 0){
		var shift = shifts[0];
		db.query("INSERT INTO workday (id, user_id, lager_id, date, start, end) VALUES(NULL, ?, ?, ?, ?, ?)", [uid, shift.lager, date, shift.start, shift.end], function(results){
			addBreaks(uid, date, shift.breaks, shifts.length > 1 ? cb : callback);
		});
	}else{
		callback({error: true, msg: "Unknown combination of time slot/lager. Try again"});
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

exports.removeWorkday = function(uid, shift_id, callback){
	db.query("SELECT date FROM workday WHERE id = ? AND user_id = ?", [shift_id, uid], function(results){
		if(results.length > 0){
			db.query("DELETE FROM breaks WHERE date = ?;DELETE FROM workday WHERE id = ? AND user_id = ?", [results[0].date, shift_id, uid], callback);
		}else{
			callback({error: true, msg: "Could not find the work shift you asked for"});
		}
	});
};

exports.getWorkShifts = function(uid, callback){
	db.query("SELECT W.id AS id, DATE_FORMAT(W.date, '%a %d %b') AS date, TIME_FORMAT(W.start, '%H:%i') AS start, TIME_FORMAT(W.end, '%H:%i') AS end, L.name AS lager FROM workday W LEFT JOIN lager L ON L.id = W.lager_id WHERE W.user_id = ? ORDER BY W.date,W.start", [uid], callback);
};

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
	db.query("SELECT IFNULL(hours, 0) AS hours FROM workhours WHERE user_id = ? AND lager_id = ? AND IsToday(date)", [uid, lager], function(results){
		data["day"]["hours"] = getProperty(results, "hours");
		db.query("SELECT IFNULL(SUM(hours), 0) AS hours FROM workhours WHERE user_id = ? AND lager_id = ? AND IsThisWeek(date)", [uid, lager], function(results){
			data["week"]["hours"] = getProperty(results, "hours");
			db.query("SELECT IFNULL(SUM(kolli), 0) AS kolli FROM currentplock WHERE IsToday(date) AND user_id = ? AND lager_id = ?", [uid, lager], function(results){
				data["day"]["kolli"] = getProperty(results, "kolli");
				db.query("SELECT IFNULL(SUM(kolli), 0) AS kolli FROM currentplock WHERE IsThisWeek(date) AND user_id = ? AND lager_id = ?", [uid, lager], function(results){
					data["week"]["kolli"] = getProperty(results, "kolli");
					db.query("SELECT IFNULL(time, 0) AS time FROM dayprogress WHERE IsToday(date) AND user_id = ? AND lager_id = ?", [uid, lager], function(results){
						data["day"]["hoursPassed"] = getProperty(results, "time");
						db.query("SELECT IFNULL(SUM(time), 0) AS time FROM dayprogress WHERE IsThisWeek(date) AND user_id = ? AND lager_id = ?", [uid, lager], function(results){
							data["week"]["hoursPassed"] = getProperty(results, "time");
							db.query("SELECT snitt FROM lager WHERE id = ?", [lager], function(results){
								data["snitt"] = getProperty(results, "snitt");
								processStats(data, callback);
							});
						});
					});
				});
			});
		});
	});
};
exports.getWeekStats = function(uid, callback){
	var data = {};
	db.query("SELECT name FROM lager ORDER BY id", [uid], function(results){
		data.lager = results;
		db.query("SELECT L.name AS lager, D.name AS weekday, DATE_FORMAT(W.date, '%Y-%m-%d') AS date, W.start AS start, W.end AS end, IFNULL(P.kolli, IF(W.date<CURDATE(), -1, 0)) AS kolli FROM days D LEFT JOIN lager L ON 1=1 LEFT JOIN workday W ON WEEKDAY(W.date) = D.index AND IsThisWeek(W.date) AND W.user_id = ? AND L.id = W.lager_id LEFT JOIN currentplock P ON P.lager_id = W.lager_id AND P.date = W.date AND IsWithinReasonableTime(P.time, W.start, W.end) ORDER BY D.index, L.id", [uid], function(results){
			data.stats = [];
			var day, index = 0;
			results.forEach(function(res){
				if(res.weekday != day){
					data.stats[++index] = [];
					day = res.weekday;
				}
				data.stats[index].push(res);
			});
			callback(data);
		});
	});
};

function processStats(stats, callback){
	var data = {day:{}, week:{}};
	stats["day"]["progress"] = {};
	stats["day"]["progress"]["kolli"] = safePercentCount(stats["day"]["kolli"], stats["snitt"]*stats["day"]["hours"]);
	stats["day"]["progress"]["time"] = safePercentCount(stats["day"]["hoursPassed"], stats["day"]["hours"]);
	stats["day"]["progress"]["extratime"] = Math.round((stats["day"]["kolli"]-stats["snitt"]*stats["day"]["hoursPassed"])/stats["snitt"]*60);
	stats["day"]["progress"]["snitt"] = stats["day"]["hoursPassed"] == 0 ? 0 : Math.round(stats["day"]["kolli"]/stats["day"]["hoursPassed"]);
	stats["day"]["expectedkolli"] = Math.round(stats["snitt"]*stats["day"]["hours"]);
	stats["week"]["progress"] = {};
	stats["week"]["progress"]["kolli"] = safePercentCount(stats["week"]["kolli"], stats["snitt"]*stats["week"]["hours"]);
	stats["week"]["progress"]["time"] = safePercentCount(stats["week"]["hoursPassed"], stats["week"]["hours"]);
	stats["week"]["progress"]["extratime"] = Math.round((stats["week"]["kolli"]-stats["snitt"]*stats["week"]["hoursPassed"])/stats["snitt"]*60);
	stats["week"]["progress"]["snitt"] = stats["week"]["hoursPassed"] == 0 ? 0 : Math.round(stats["week"]["kolli"]/stats["week"]["hoursPassed"]);
	stats["week"]["expectedkolli"] = Math.round(stats["snitt"]*stats["week"]["hours"]);
	callback(stats);
}

function getProperty(arr, prop){
	return arr.length > 0 ? arr[0][prop] : 0;
}

function safePercentCount(numerator, denominator){
	return denominator == 0 ? 0 : Math.round(numerator/denominator*100);
}