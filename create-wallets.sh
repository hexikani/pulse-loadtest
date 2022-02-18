#!/bin/bash
task() {
	node create-wallets.js `printf %04d $1`
}

N=4
for I in `seq 0 99`; do
	((i=i%N)); ((i++==0)) && wait
	task $I &
done

wait
