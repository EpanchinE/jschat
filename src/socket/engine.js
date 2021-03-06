var engine = require('engine.io');
var signer = require('secure.me')({salt:nconf.get('security:salt')}).signer({salt:nconf.get('security:salt')});
var async = require('async');
//var Rooms = require('engine.io-rooms');
var UserModel = require('../models').user;
var rooms = require('./rooms.js');

var err = function(msg){
  return {
    t: "error",
    m: msg
  }
}

module.exports = function(server){
  server = engine.attach(server);
  server = rooms(server);
  server.on('connection', function(socket){
    // TODO: change status of a user to online
    socket.on('message', function(data){
      try{
        data = JSON.parse(data);
      } catch(e){
        return handleErrors(err("Invalid socket message"), socket, data);
      }
      async.series(
        [
          async.apply(logger, socket, data),
          async.apply(authorization, socket, data),
          async.apply(statusMsg, socket, data),
          async.apply(scopeMsgData, socket, data),
          async.apply(sysMsg, socket, data),
          async.apply(writingStatus, socket, data),
          async.apply(message, socket, data),
          async.apply(saveMessageInDB, socket, data)
        ],
        function(err){
          handleErrors(err, socket, data);
        }
      );
    });
    // TODO: socket on close
    // socket that was closed should find corresponding user and change it's status to offline.
  });
}

function scopeData(socket, data){
  return data.send = function(){
    socket.to(data.r).send(JSON.stringify(data));
    console.log("sent in room + " + data.r);
    delete data.send;
    return 
  }
}

function logger(socket, data, next){
  console.log(data.t + " : socket msg, user: " + socket.user);
 /* data.r && socket.room(data.r).clients(function(err, clients) {
    console.log(clients + "- users in the room " + data.r); // output array of socket ids
  });
*/


  next();
}

function authorization(socket, data, next){
  if(socket.user) return next();
  if(data.t == "authorization"){
    if(signer.validate(data.user)){
      socket.user = data.user;
      // suscribe for casted messages
      if(socket.user.rooms){ 
        socket.user.rooms.forEach(function(room){
          socket.join(room);
        });
      }
      // subscribe for direct messages
      return;
    } else {
      return next(err("user object is not trusted - Not authorized"));
    }
  }
  return next(err("Not authorized"));
}

function statusMsg(socket, data, next){
  //TODO: think about statuses and possibly depricate.
  // reasoning: 
  // usually you do not need instant status of a user. You always can just pool for a status
  //of those users that are displayed right now [ /api/users?_id=1,2,3,4&slice=status or smth like this]
  // on a frontend statuses coud cache themselves, expire in 2-3 sec and pool only those that displayed
  //change status of user, broadcast it (online, offline, away, dnd)
  //handle offline somehow
  //save all states to a user collection
  next();
}





function scopeMsgData(socket, data, next){
  // room Id's
  if(data.r) {
    // check if room/s
    scopeData(socket, data);
  }
  // user Id's
  if(data.u) {
    // if this is a set of users (private room), broadcast message to those users
    // to do this - use common emitter where guys will listen to messages adressed to them
  }

  // what to do if there is no scope??
  next();
}


// rooms:
//  _id:
//  description
//  public_id
//  [users]

function sysMsg(socket, data, next){
  if(data.t == "sys"){
    var user = UserModel.user(socket.user);
    if(data.m == "joinRoom"){
      socket.join(data.r.toString(), function(){
        console.log(arguments);
      });
      user.joinRoom(data.r, function(err){
        !err && console.log("user " + socket.user._id + " joined room " + data.r);
        err && console.log(err);
      })
    }
  }
  // join room (put in user the room, and put in room the user)
  next();
}

function writingStatus(socket, data, next){
  //broadcast writing message
  //send writing message once per second
  //do not send it to offline/away guys (think about it)
  next();
}

function message(socket, data, next){
  //broadcast simple message to scope
  console.log("sendind data");
  data.send && data.send();
  next();
}

function saveMessageInDB(socket, data, next){
  // message datastructure:
  //  _id     - timestamp/id
  //  text    - raw text
  //  userId  - user id that sended it
  //  repl    - id of message that was replied
  // additional info that is not saved
  //  lat/lng - position of a guy
  //  mentions- array of id's that were mentioned
  //  hashes  - hashes that were mentioned in message
  //  links   - links that were mentioned in message
  //  room    - roomID

  // save in DB, emit error if saving failed
}

function handleErrors( err,data, socket){
  //socket.send(JSON.stringify(data));
  console.log(err);
}
