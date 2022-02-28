// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @dev Interface of the PVSTicket Burn & Mint.
 */
interface IPVSTicket {
    /**
     * @dev Burn `amount` tokens from the _ticketOwner's account to `address(0)`.
     */
    function burn(address _ticketOwner, uint256 _amount) external;

     /**
     * @dev Mint `amount` tokens from the `address(0)` to  _ticketOwner's account.
     */
    function mint(address _ticketOwner, uint256 _amount) external;

     /**
     * @dev Emitted when `value` tokens are moved from one account (`owner`) to
     * another (`burner`).
     *
     * Note that `value` may be zero.
     */
    event TicketBurned(address indexed owner, address indexed burner, uint256 value);

     /**
     * @dev Emitted when `value` tokens are moved from one account (`minter`) to
     * another (`owner`).
     *
     * Note that `value` may be zero.
     */
    event TicketMinted(address indexed minter, address indexed owner, uint256 value);
}