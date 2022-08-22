all: test_signaling

test_signaling : test_signaling.c
	gcc -o $@ $^ -g -Os
	chown nobody test_signaling
	chmod +s test_signaling

clean :
	rm -rf test_signaling

