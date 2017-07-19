/************** DOCS **********************
**	Simple database wrapper in order to	 **
**	make life easier when applying a db	 **
**	query.							   	 **
******************************************/ 

var mysql = require('mysql');
var connection;
var dbParams;

exports.connect = function(host, user, pw, db){
	dbParams = {host: host, user: user, password: pw, database: db};
	doConnect();
}

exports.query = function(query, data, callback){
	connection.query(query, data, function(error, results, fields){
		if(error) throw error;
		callback(results);
	});
}

exports.disconnect = function(){
	connection.end();
}

/* Thanks to cloudymarble @ https://stackoverflow.com/a/20211143 */
function doConnect(){
	connection = mysql.createConnection(dbParams);
	connection.connect(function(err){
		if(err){
			console.log("Could not connect to database, retrying soon...");
			setTimeout(doConnect, 5000);
		}else{
			console.log("Connected to the database");
		}
	});
	connection.on('error', function(err){
		console.log("Got a database error: ", err);
		if(err.code == "PROTOCOL_CONNECTION_LOST"){
			doConnect();
		}else{
			throw err;
		}
	});
}