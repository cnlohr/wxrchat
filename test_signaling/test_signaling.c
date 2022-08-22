#include <stdio.h>

#define CNFGHTTP
#define CNFGHTTPSERVERONLY
#define CNFG_DISABLE_HTTP_FILES
#define CNFG_IMPLEMENTATION
#define HTTP_CONNECTIONS 254
#define MAX_HTTP_PATHLEN 2048

#include "rawdraw_sf.h"

// First 40 chars are the code.
// After that is the SDP.
#define CODELENGTH 40

/// JANKY SERVER BAD PROTOCOL
// Get /d/list?[40-byte-thing][SDP]
// Get /d/conn?[40-byte-thing] gets SDP
// Get /d/answ?sha1(([40-byte-thing][sdp]))

static void readrdbuffer_websocket_dat(  int len )
{
	int bufferok = TCPCanSend( curhttp->socket, 1340 );
	printf( "Dat: %d\n", bufferok );
	WebSocketSend( "hello\n", 6 );
}
static void readrdbuffer_websocket_cmd(  int len )
{
	uint8_t  buf[1300];
	int i;

	if( len > 1300 ) len = 1300;

	for( i = 0; i < len; i++ )
	{
		buf[i] = WSPOPMASK();
	}
	printf( "Got: %02x\n", buf[0] );
}



void HTTPCustomCallback( )
{
	if( curhttp->rcb )
		((void(*)())curhttp->rcb)();
	else
		curhttp->isdone = 1;
}


//Close of curhttp happened.
void CloseEvent()
{
}


void NewWebSocket()
{
	printf( "New Websocket %s\n", curhttp->pathbuffer );
	if( strncmp( (const char*)curhttp->pathbuffer, "/d/ws/nvp", 9 ) == 0 )
	{
		printf( "Got connection.\n" );
		curhttp->rcb = (void*)&readrdbuffer_websocket_dat;
		curhttp->rcbDat = (void*)&readrdbuffer_websocket_cmd;
	}
	else
	{
		curhttp->is404 = 1;
	}
}

void WebSocketTick()
{
	if( curhttp->rcb )
	{
		((void(*)())curhttp->rcb)();
	}
}

void WebSocketData( int len )
{
	if( curhttp->rcbDat )
	{
		((void(*)( int ))curhttp->rcbDat)(  len ); 
	}
}


static void list()
{
	if( TCPCanSend(curhttp->socket, MAX_HTTP_PATHLEN ) )
	{
		if( curhttp->data.user.a == 0 )
		{
			const char * sendheader = "HTTP/2.0 200 Ok\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: text/plain\r\n\r\n";
			PushBlob( sendheader, strlen(sendheader) );
			if( strlen( curhttp->pathbuffer ) < 8 + CODELENGTH )
			{
				PushBlob( "NA", 2 );
				EndTCPWrite( curhttp->socket );
				curhttp->state = HTTP_WAIT_CLOSE;
				return;
			}
			EndTCPWrite( curhttp->socket );
			curhttp->data.user.a = 1;
			
			printf( "LIST WAITING: %d\n", curhttp - HTTPConnections );
		}
		else if( curhttp->data.user.a == 2 )
		{
			char * sl = curhttp->pathbuffer + 8 + CODELENGTH;
			PushBlob( sl, strlen( sl ) );
			EndTCPWrite( curhttp->socket );
			curhttp->state = HTTP_WAIT_CLOSE;
		}
	}
}


static void echo()
{
	char mydat[128];
	int len = URLDecode( mydat, 128, curhttp->pathbuffer+8 );
	printf( "Echo read %s\n", mydat );
	if( TCPCanSend(curhttp->socket, 1340 ) )
	{
		printf( "Echo send %s\n", mydat );
		const char * sendheader = "HTTP/1.1 200 Ok\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: text/plain\r\n\r\n";
		PushBlob( sendheader, strlen(sendheader) );
		PushBlob( mydat, len );
		EndTCPWrite( curhttp->socket );

		curhttp->state = HTTP_WAIT_CLOSE;
	}
}


static void conn()
{
	//int len = URLDecode( mydat, 128, curhttp->pathbuffer+10 );
	char * code = curhttp->pathbuffer+8;
	
	if( TCPCanSend(curhttp->socket, MAX_HTTP_PATHLEN ) )
	{
		int i;

		const char * sendheader = "HTTP/1.1 200 Ok\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: text/plain\r\n\r\n";
		PushBlob( sendheader, strlen(sendheader) );
		
		if( strlen( code ) >= CODELENGTH )
		{
			for( i = 0; i < HTTP_CONNECTIONS; i++ )
			{
				if( HTTPConnections[i].state == HTTP_STATE_DATA_XFER &&
					memcmp( HTTPConnections[i].pathbuffer + 8, curhttp->pathbuffer + 8, CODELENGTH ) == 0 &&
					HTTPConnections[i].data.user.a == 1 && curhttp != &HTTPConnections[i] )
				{
					// Found it.  Forward SDP to this client.
					char * tsback = HTTPConnections[i].pathbuffer + 8 + CODELENGTH;
					int len = strlen( tsback );
					PushBlob( tsback, len );
					*(HTTPConnections[i].pathbuffer + 8 + CODELENGTH) = 0; // Get rid of message.
					EndTCPWrite( curhttp->socket );
					curhttp->state = HTTP_WAIT_CLOSE;
					return;
				}
			}
		}
		PushBlob( "NA", 2 );
		EndTCPWrite( curhttp->socket );
		curhttp->state = HTTP_WAIT_CLOSE;
	}
}

static void answ()
{
	char mydat[128];
	//int len = URLDecode( mydat, 128, curhttp->pathbuffer+10 );
	char * code = curhttp->pathbuffer+8;
	int lenpluscode = strlen( code );
	
	if( TCPCanSend(curhttp->socket, MAX_HTTP_PATHLEN ) )
	{
		int i;

		const char * sendheader = "HTTP/1.1 200 Ok\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: text/plain\r\n\r\n";
		PushBlob( sendheader, strlen(sendheader) );

		if( strlen( code ) >= CODELENGTH )
		{
			for( i = 0; i < HTTP_CONNECTIONS; i++ )
			{
				if( HTTPConnections[i].state == HTTP_STATE_DATA_XFER &&
					memcmp( HTTPConnections[i].pathbuffer + 8, curhttp->pathbuffer + 8, CODELENGTH ) == 0 && 
					lenpluscode >= CODELENGTH && HTTPConnections[i].data.user.a == 1 && curhttp != &HTTPConnections[i] )
				{
					printf( "ANSWERING %d\n", i );
					memcpy( HTTPConnections[i].pathbuffer + 8 + CODELENGTH, 
						code + CODELENGTH, lenpluscode - CODELENGTH );
					HTTPConnections[i].data.user.a = 2;
					PushBlob( "OK", 2 );
					EndTCPWrite( curhttp->socket );
					curhttp->state = HTTP_WAIT_CLOSE;
					return;
				}
			}
		}
		PushBlob( "NA", 2 );
		EndTCPWrite( curhttp->socket );
		curhttp->state = HTTP_WAIT_CLOSE;
	}
}


void HTTPCustomStart( )
{
	curhttp->data.user.a = 0;
	if( strncmp( (const char*)curhttp->pathbuffer, "/d/echo?", 8 ) == 0 )
	{
		curhttp->rcb = (void(*)())&echo;
		curhttp->bytesleft = 0xfffffffe;
	}
	else if( strncmp( (const char*)curhttp->pathbuffer, "/d/list?", 8 ) == 0 )
	{
		curhttp->rcb = (void(*)())&list;
		curhttp->bytesleft = 0xfffffffe;
	}
	else if( strncmp( (const char*)curhttp->pathbuffer, "/d/conn?", 8 ) == 0 )
	{
		curhttp->rcb = (void(*)())&conn;
		curhttp->bytesleft = 0xfffffffe;
	}
	else if( strncmp( (const char*)curhttp->pathbuffer, "/d/answ?", 8 ) == 0 )
	{
		curhttp->rcb = (void(*)())&answ;
		curhttp->bytesleft = 0xfffffffe;
	}
	else
	{
		curhttp->rcb = 0;
		curhttp->bytesleft = 0;
		curhttp->isfirst = 1;
		HTTPHandleInternalCallback();
	}
}


int main()
{
	RunHTTP( 8888 );

	while( 1 )
	{
		TickHTTP();
	}
}

