#include <stdio.h>

#define CNFGHTTP
#define CNFGHTTPSERVERONLY
#define CNFG_DISABLE_HTTP_FILES
#define CNFG_IMPLEMENTATION

#include "rawdraw_sf.h"


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
	printf( "%s\n", curhttp->pathbuffer );
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

void HTTPCustomStart( )
{
	curhttp->rcb = 0;
	curhttp->bytesleft = 0;
	curhttp->isfirst = 1;
	//curhttp->is404 = 1;
	HTTPHandleInternalCallback();
}


int main()
{
	RunHTTP( 8888 );

	while( 1 )
	{
		TickHTTP();
	}
}

