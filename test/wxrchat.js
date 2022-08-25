// WebRTC Code based on https://www.youtube.com/watch?v=FExZvpVvYxA

if( typeof $ == typeof undefined ) $ = (x) => document.querySelector(x);
if( typeof $$ == typeof undefined ) $$ = (x) => document.querySelectorAll(x);
wipeChildren = (x) => { while(x.firstChild) x.removeChild(x.firstChild); }
setOnlyChild = (x, child) => { while(x.firstChild) x.removeChild(x.firstChild); x.appendChild(child); }

// Utility functions
// Arraybuffer to base-64 string.  Note: The imparaitve version of this code can't be efficient
// because javascript sematntics surrounding string manipulation require the strings to be appended.
// Sadly, the declarative version breaks on larger datasets, so we're stuck with the lame way.
//	arrayBufferToBase64 = (ab) => btoa(String.fromCharCode.apply(null, new Uint8Array(ab)));  // Crashes on larger data sets (like 1MB)
arrayBufferToBase64 = (buffer) => {
    var binary = '';
    const bytes = new Uint8Array( buffer );
    const len = bytes.byteLength | 0;
    for (var i = 0; i < len; i++)
        binary += String.fromCharCode( bytes[ i ] );
    return window.btoa( binary );
}
base64ToArrayBuffer = (base64) => {
	const binary_string =  window.atob(base64);
	const len = binary_string.length|0;
	var bytes = new Uint8Array( len );
	for (var i = 0|0; i < len; i++)
	    bytes[i] = binary_string.charCodeAt(i);
	return bytes.buffer;
}
copyElementContentsToClipboard = ( elem ) => {
	elem.focus();
	elem.select();
	elem.setSelectionRange(0, elem.value.length);
	navigator.clipboard.writeText(elem.value);
}
profileCode = ( fn, iter ) => {
	const start = performance.now();
	const i = iter|0;
	while(i--) fn();
	const end = performance.now();
	return end-start;
}



(function(wxfrontend) {
	'use strict';
	wxfrontend.warn = ( e ) => console.log( e );

	wxfrontend.tick = () => {
		let taint = false;
		if( wxfrontend.panelAJAXOpen > 0 )
		{
			const now = Date.now();
			const newDivContent = document.createElement("table");
			const newTr = document.createElement("tr");
			newDivContent.appendChild( newTr );

			wxci.trackedAJAX.forEach( req => {
				const newTd = document.createElement("td");
				newTr.appendChild( newTd );
				const newDivInner = document.createElement("div");
				newTd.appendChild( newDivInner );
				newDivInner.innerHTML = (now - req.lastTouch) + " " + req.url + "  " + req.state;
			});
			setOnlyChild( $("#ajaxdetails"), newDivContent );
			taint = true;
		}
		$("#ajaxdetailsbutton").style.background = (wxci.trackedAJAX.size>0)?"green":"lightgray"; 

		if( wxfrontend.panelIdentityOpen > 0 )
		{
			const newDiv = document.createElement("div");
			const summary = document.createElement("div");

			if( !wxci.identityOk() )
			{
				summary.innerHTML = "Public/Private Key Invalid";
			}
			else
			{
				summary.innerHTML = "Public Key: " + arrayBufferToBase64( wxci.publicKey );
			}

			newDiv.appendChild(summary); 

			const newIdentityBtn = document.createElement("input");
			newIdentityBtn.setAttribute( "type", "submit" );
			newIdentityBtn.value = "New Identity";
			newIdentityBtn.addEventListener("click", (e) => { console.log(e ); wxci.newIdentity(); requestAnimationFrame( wxfrontend.tick ); return true; } );
			newIdentityBtn.style.background = wxci.identityOk()?"lightgray":"green"; 

			if( wxci.identityOk() )
			{
				const saveBtn = document.createElement("input");
				saveBtn.setAttribute( "type", "submit" );
				saveBtn.value = "Save";
				saveBtn.addEventListener( "click", (e) => { console.log(e ); wxci.newIdentity(); requestAnimationFrame( wxfrontend.tick ); return true; } );
			}

			newDiv.appendChild(newIdentityBtn); 

			setOnlyChild( $("#identitydetails"), newDiv );		
			taint = true;
		}

		$("#identitydetailsbutton").style.background = wxci.identityOk()?"lightgray":"red"; 

		if( taint ) requestAnimationFrame( wxfrontend.tick );
	}

	wxfrontend.panelAJAXOpen = false;
	wxfrontend.panelIdentityOpen = false;

	wxfrontend.panelToggleAJAX = () => {
		wxfrontend.panelAJAXOpen ^= true;
		$("#ajaxdetails").style.display = (wxfrontend.panelAJAXOpen)?"block":"none";
		requestAnimationFrame( wxfrontend.tick );
	}

	wxfrontend.panelToggleIdentity = () => {
		wxfrontend.panelIdentityOpen ^= true;
		$("#identitydetails").style.display = (wxfrontend.panelIdentityOpen)?"block":"none";
		requestAnimationFrame( wxfrontend.tick );
	}

	requestAnimationFrame( wxfrontend.tick );
})(self.wxfrontend = self.wxfrontend || {});











// You will need to call wxci.load() on startup.

(function(wxci) {
	'use strict';


	// Create a tracked AJAX request, one that will "appear" in our list of ajax requests.
	// 
	wxci.createTrackedAJAX = ( url, onload ) => {
		var xhr = new XMLHttpRequest();
		wxci.trackedAJAX.add( xhr );
		xhr.timeoutFn = () => wxci.trackedAJAX.delete( xhr );
		xhr.lastTouch = Date.now();
		xhr.onerror = (e) => {
			console.log( "Error making request to " + url, e );
			xhr.timeout = setTimeout( xhr.timeoutFn, 5000 );
			xhr.lastTouch = Date.now();
		}
		xhr.onprogress = () => xhr.lastTouch = Date.now();
		xhr.onload = (l) => {
			onload(l);
			xhr.timeout = setTimeout( xhr.timeoutFn, 5000 );
			xhr.lastTouch = Date.now();
		}
		xhr.open( "GET", url );
		return xhr;
	}




	wxci.defaultSTUNServer = "stun:stun.l.google.com:19302";
	wxci.signalingServer = "http://s.wxr.chat:8080/d/";  // Needs trailing '/'
	wxci.currentPeersByID = [];
	wxci.trackedAJAX = new Set();

	wxci.privateKey = new Uint8Array(0);
	wxci.publicKey = new Uint8Array(0);
	wxci.identityOk = () => ( wxci.privateKey.byteLength == 32 && wxci.publicKey.byteLength == 32 ); 

	wxci.load = () => {
		wxci.privateKey = base64ToArrayBuffer( localStorage.getItem( "__wxPrivateKey" ) );
		wxci.publicKey = base64ToArrayBuffer( localStorage.getItem( "__wxPublicKey" ) );
		if( wxci.privateKey.byteLength != 32 || wxci.publicKey.byteLength != 32 )
		{
			wxfrontend.warn( "Could load load public/private key pair.  You will need to generate a new identity." ); 
		}
	}
	wxci.newIdentity = () => {
		var randomValuesArray = new Uint8Array(32);
		var pubpriv = axlsign.generateKeyPair( window.crypto.getRandomValues(randomValuesArray) );
		wxci.privateKey = pubpriv.private;
		wxci.publicKey = pubpriv.public;
	}
	wxci.saveIdentity = () => {
		if( !wxci.identityOk() )
		{
			wxfrontend.warn( "Public/private keys not currently loaded.  Cannot save." );
		}
		else
		{
			localStorage.setItem( "__wxPrivateKey", arrayBufferToBase64( wxci.privateKey ) );
			localStorage.setItem( "__wxPublicKey", arrayBufferToBase64( wxci.publicKey ) );
		}
	}

	wxci.addLocalWebRTC = function( callback, use_signaling_server ) {
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

	wxci.addRemoteWebRTC = function( sdp, callback )
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
})((self.wxci = self.wxci || {}));

// For some libraries (see axlsign) we actually say (typeof module !== 'undefined' && module.exports ? module.exports : (self.wxci = self.wxci || {}));
// But we don't need that here, since it's in-browser only.


