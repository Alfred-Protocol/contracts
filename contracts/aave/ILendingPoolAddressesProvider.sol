// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.9;

interface LendingPoolAddressesProvider {
    /**
     * @dev Returns the address of the LendingPool proxy
     * @return address LendingPool proxy address
    **/
    function getLendingPool() external returns (address);
}