// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

error FundHasStarted(uint256 timeNow, uint256 startTime);
error FundHasEnded(uint256 timeNow, uint256 endTime);
error FundHasNotEnded(uint256 timeNow, uint256 endTime);
error CallerIsNotFundManager(address fundManager);
