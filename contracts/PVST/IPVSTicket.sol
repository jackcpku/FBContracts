// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @dev Interface of the PVSTicket Burn & Mint.
 */
interface IPVSTicket {
    /**
     * @dev Burn `amount` tickets from the _ticketOwner's account to `address(0)`.
     */
    function burn(address _ticketOwner, uint256 _amount) external;

    /**
     * @dev Mint `amount` tickets from the `address(0)` to  _ticketOwner's account.
     */
    function mint(address _ticketOwner, uint256 _amount) external;

    /**
     * @dev Emitted when `amount` tickets from (`owner`) were burned by (`burner`).
     *
     * Note that `value` may be zero.
     */
    event TicketBurned(
        address indexed owner,
        address indexed burner,
        uint256 amount
    );

    /**
     * @dev Emitted when `amount` tickets were minted by (`minter`) to (`owner`).
     *
     * Note that `value` may be zero.
     */
    event TicketMinted(
        address indexed owner,
        address indexed minter,
        uint256 amount
    );
}
