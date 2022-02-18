#!/bin/bash

for I in `seq 0 99`; do
	node agent.js `printf "%04d" $I` &
done

wait
