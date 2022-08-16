// WebRTC Code based on https://www.youtube.com/watch?v=FExZvpVvYxA

wxrpeers = [];

function WXRAddLocal( callback )
{
	// This is the originator.
	console.log( "AddLocal" );
	
	const lc = new RTCPeerConnection( { iceServers: [ { urls: "stun:stun.l.google.com:19302" } ] });
	const dc = lc.createDataChannel("wxrchat");
	dc.onmessage = e => WXLog("Got a message " + e.data);
	dc.onopen = e => WXLog("Connection opened " + e );
	lc.onicecandidate = e => callback( lc, JSON.stringify( lc.localDescription ) );
	lc.createOffer().then( o => lc.setLocalDescription(o) ).then( a => WXLog( "Set description Successfully." ) );

	lc.dc = dc;
	
	wxrpeers.push( { lc:lc, dc:dc } );
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
	
	wxrpeers.push( { rc:rc, dc:dc } );
}

