// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

contract BurnContract {
   
    event SetEvent(uint256, uint256);
    event FoundEvent(uint256);
    event NotFoundEvent();

    mapping(uint256=>uint256) store;
    
    function get(uint256 key) public view returns(uint256) {
        return store[key];
    }

    function set(uint256 key, uint256 value) public {
        store[key] = value;
        emit SetEvent(key, value);
    }
    
    function randomSeed() public view returns(uint256) {
        return uint256(keccak256(abi.encodePacked(block.timestamp,block.difficulty,  msg.sender)));
    }

    function write(uint256 key, uint256 count) public {
        uint256 seed = randomSeed() & 0xFFFFFFFF;

        for (uint256 i = 0; i < count; i++) {
            uint256 s = 0;
            for (uint j = 0; j < 256/8; j++) {
                seed = (seed * 98801 + 4561) & 0xFFFFFFFF;
                s <<= 8;
                s |= uint8(seed & 0xff);
            }
            set(key + i, s);
        }
    }

    function search(uint256 key, uint256 count, uint256 needle) public returns(bool) {
        for (uint256 i = 0; i < count; i++) {
            if(get(key+i) == needle) {
                emit FoundEvent(key + 1);
                return true;
            }
        }
        emit NotFoundEvent();
        return false;
    }    
}

