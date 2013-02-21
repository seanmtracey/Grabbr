var util = require('util'),
	twitter = require('twitter'),
	S = require('string'),
	express = require('express'),
	app = express(),
	request = require("request"),
	nodemailer = require('nodemailer'),
	jsdom = require("jsdom"),
	fs = require('fs');

//Credentials for the Twitter App
var twit =  new twitter({
	consumer_key : 'CONSUMER KEY',
	consumer_secret : 'CONSUMER_SECRET',
	access_token_key : 'ACCESS_TOKEN_KEY',
	access_token_secret : 'ACCESS_TOKEN_SECRET'
});

var potentialArticle = function(pageTitle, url, tweetId, username){
	this.pageTitle = pageTitle;
	this.url = url;
	this.tweetId = tweetId;
	this.username = username;
}

function getFavourites(username){
	
	console.log("Grabbing favourites from Twitter for @" + username);
	
	var articleURLS = [];	
	var numberOfArticles = 0;
	var previousFavourites = [];
	var howManyArticlesDoWeHave;
	
	fs.readFile('previousFavourites.txt', 'utf8', function (err,data) {
		if (err) {
			return console.log(err);
		} else {
			if(data.length > 1){
				previousFavourites = JSON.parse(data);
			}
		}
	});
	
	twit.get('http://api.twitter.com/1.1/favorites/list.json', {screen_name : username, include_entities : true}, function(data){
		
		if(data.statusCode !== undefined && data.statusCode == 429){
			console.log("Request Limit Hit  - Make a Cuppa");
			return;
		}	
		
		for(var x = 0; x < data.length; x += 1){
			if(data[x].entities.urls.length > 0){
				
				var sentBefore = false;
				
				for(var c = 0; c < previousFavourites.length; c += 1){
					
					if(data[x].entities.urls[0].expanded_url === previousFavourites[c]){
						sentBefore = true;
						//console.log("Story already sent");
						break;
					}
					
				}
				
				if(!sentBefore){
					
					numberOfArticles += 1;
					(function(data, x){
						
						//You can include Js files to be included in the window object if you so wish
						jsdom.env(data.entities.urls[0].expanded_url/*, ["http://code.jquery.com/jquery.js"]*/,function (errors, window) {
							
							try{
								window.document.title;
							} catch(error) {
								console.log("There was an error...\n\n" + error + "\n\n...Trying again...");
								getFavourites(username);
								return false;
							}
							
							console.log(window.document.title);
							
							previousFavourites.push(data.entities.urls[0].expanded_url);
							articleURLS.push(new potentialArticle(window.document.title, data.entities.urls[0].expanded_url, data.id, data.user.name));
						});
						
					})(data[x], x);
				
				}
				
			}
		}
		
		howManyArticlesDoWeHave = setInterval(function(){
			if(articleURLS.length == numberOfArticles){
				
				fs.writeFile("previousFavourites.txt", JSON.stringify(previousFavourites), function(err) {
				    if(err) {
				        console.log(err);
				    } else {
				        console.log("Saved article URLS to file");
				    }
				});
				if(numberOfArticles > 0){
					mailArticles('seanmtracey@gmail.com', articleURLS);
				} else {
					console.log("Nothing to send today");
				}
				clearInterval(howManyArticlesDoWeHave);
			}
		}, 1000);

	});
	
}

function mailArticles(address, articleAddresses){
	
	// create reusable transport method (opens pool of SMTP connections)
	var smtpTransport = nodemailer.createTransport("SMTP",{
	    service: "Gmail",
	    auth: {
	        user: "YOUR EMAIL ADDRESS TO SEND MAIL FROM",
	        pass: "THE EMAIL ADDRESSES PASSWORD"
	    }
	});
	
	var html = "<style>html{background-color:rgba(0,0,0,.05);font-family:Helvetica Neue,Helvetica;}h1,h2,h3,h4,h5,h6,ul,li{margin:0;padding:0;font-weight:400;color:rgba(0,0,0,.5);}header{text-align:center;width:100%}.done{background-color:lightblue;color:white;display:inline-block;padding:5px 20px 5px 20px;text-decoration:none;box-shadow:0px 1px 2px rgba(0,0,0,.5);text-shadow:0px 1px 1px black;background:#049cdb;background:-moz-linear-gradient(top,#049cdb 0%,#0064cd 100%);background:-webkit-gradient(linear,left top,left bottom,color-stop(0%,#049cdb),color-stop(100%,#0064cd));background:-webkit-linear-gradient(top,#049cdb 0%,#0064cd 100%);background:-o-linear-gradient(top,#049cdb 0%,#0064cd 100%);background:-ms-linear-gradient(top,#049cdb 0%,#0064cd 100%);background:linear-gradient(to bottom,#049cdb 0%,#0064cd 100%);filter:progid:DXImageTransform.Microsoft.gradient(startColorstr='#049cdb',endColorstr='#0064cd',GradientType=0);}#articleList{width:100%;padding-top:20px;padding-bottom:20px;}.article{background-color:white;box-shadow:0 1px 2px rgba(0,0,0,0.5);margin-bottom:10px;padding:5px 10px 10px;text-align:center;}.article div{overflow-x: scroll;overflow-y: hidden;width:100%;margin:0 0 0px 0;padding:0;}.article div a{padding:3px 0 3px 0; color: rgba(0, 0, 0, 0.5);font-size: 16pt;text-decoration: none;max-height: 1em;overflow-x: scroll;overflow-y: hidden; white-space: nowrap; -webkit-overflow-scrolling: touch;}.article h6{margin-bottom:6px; color:rgba(0,0,0,.35);}</style>";
	
	html += "<header><h1>Grabbr</h1><h2>Today's Favourites</h2></header>"
	
	html += "<div id='articleList'>"
	
	for(var z = 0; z < articleAddresses.length; z += 1){
		html += "<div class='article'><div><a href='" + articleAddresses[z].url + "'>" + articleAddresses[z].pageTitle + "</a></div><h6><strong>Posted by: </strong>" + articleAddresses[z].username + "</h6><a class='done' href='http://sean.mtracey.org/stuff/grabbr?tweetId=" + articleAddresses[z].tweetId + "'>Done.</a></div>";
	}
	
	html += "</div>"
	
	// setup e-mail data with unicode symbols
	var mailOptions = {
	    from: "FROM", // sender address
	    to: address, // list of receivers
	    subject: "Todays favourites", // Subject line
	    text: "Well, This has gone rather well!", // plaintext body
	    html: html // html body
	}
	
	// send mail with defined transport object
	smtpTransport.sendMail(mailOptions, function(error, response){
	    if(error){
	        console.log(error);
	    }else{
	        console.log("Message sent: " + response.message);
	    }
		
	    smtpTransport.close();
	    sent = true;
	    lastSent = currentTime.getDate();
		inProgress = false;
	});
	
}

//The hour of the day you want to recieve the email
var whenDoYouWantThese = 19;
var currentTime;
var today;
var lastSent;
var sent = false;
var inProgress = false;
var delay = 1 * 1000 * 60 * 50;
//getFavourites('seanmtracey');

/*var showDate;*/

setInterval((function(){
	currentTime = new Date();
	today = currentTime.getDate();
	if(currentTime.getHours() == whenDoYouWantThese){
		if(inProgress == true){
			console.log("It's in progress. Have some patience, would you?");
		} else if(sent == false && inProgress == false){
			inProgress = true;
			getFavourites('seanmtracey');
		} else if(sent == true && lastSent < today){
			getFavourites('seanmtracey');
		} else {
			console.log("Keep Waiting, It's not time yet. They've already been sent.");
		}
	} else {
		console.log("Keep Waiting. \"Tick Tock\", Goes the clock.")
	}
	
	console.log(currentTime);
}),  delay);