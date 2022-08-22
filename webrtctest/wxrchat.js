// WebRTC Code based on https://www.youtube.com/watch?v=FExZvpVvYxA

wxrpeers = [];
let default_stun_server = "stun:stun.l.google.com:19302";
let default_signal_server = "http://s.wxr.chat:8080/d/";

// from https://stackoverflow.com/questions/30008114/how-do-i-promisify-native-xhr
function WXRXMLHTTPRequest (url) {
	return new Promise(function (resolve, reject) {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", url);
		xhr.onload = function () {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve(xhr.response);
			} else {
				reject({
					status: xhr.status,
					statusText: xhr.statusText
				});
			}
		};
		xhr.onerror = function () {
			reject({
				status: xhr.status,
				statusText: xhr.statusText
			});
		};
		xhr.send();
	});
}

function WRXCopyElementTextToClipboard( elem )
{
	elem.focus();
	elem.select();
	elem.setSelectionRange(0, 99999);
	navigator.clipboard.writeText(elem.value);
}


function WXRAddLocal( callback, use_signaling_server )
{
	// This is the originator.
	console.log( "AddLocal" );

	const uuid = crypto.randomUUID() + "----";
	const lc = new RTCPeerConnection( { iceServers: [ { urls: default_stun_server } ] });
	const dc = lc.createDataChannel("wxrchat");
	dc.onmessage = e => WXLog("Got a message " + e.data);
	dc.onopen = e => WXLog("Connection opened " + e );
	lc.onicecandidate = e => {
		if( use_signaling_server )
		{
			WXRXMLHTTPRequest( default_signal_server + "list?" + uuid + btoa( JSON.stringify( lc.localDescription ) ) ).then( r => console.log( "GOT REPLY: " + r ) );
			callback( lc, uuid );
		}
		else
		{
			callback( lc, JSON.stringify( lc.localDescription ) );
		}
	};
	lc.createOffer().then( o => lc.setLocalDescription(o) ).then( a => WXLog( "Set description Successfully." ) );
	lc.dc = dc;	
	
	wxrpeers.push( { rc:lc, dc:dc, dir:0, uuid : uuid} );
}

function WXRAddRemote( sdp, callback )
{
	console.log( "AddRemote" );
	console.log( sdp );
	
	const rc = new RTCPeerConnection( {iceServers: [ { urls: "stun:stun.l.google.com:19302" } ] });
	
	rc.onicecandidate = e => {
		console.log( rc.localDescription );
		callback( rc, JSON.stringify( rc.localDescription ) );
	}
	rc.ondatachannel = e => {
		rc.dc = e.channel;
		rc.dc.onmessage = e=> WXLog("Got Message: " + e.data);
		rc.dc.onopen = e=> WXLog( "Got Connection: " + JSON.stringify( e ) );
	}
	rc.setRemoteDescription( JSON.parse( sdp ) ).then( a => WXLog( "Offset Set" ) );
	rc.createAnswer().then( a=>rc.setLocalDescription(a)).then( WXLog( "Got Answer" ) );

	const dc = rc.createDataChannel("wxrchat");
	dc.onmessage = e => WXLog("Got a message " + e.data);
	dc.onopen = e => WXLog("Connection opened " + e );
	//rc.createOffer().then( o => rc.setLocalDescription(o) ).then( a => WXLog( "Set description Successfully." ) );
	rc.dc = dc;
	
	wxrpeers.push( { rc:rc, dc:dc, dir:1 } );
}




