//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// interface ERC1363 is ERC20, ERC165 {
interface ERC1363 {
  /*
   * Note: the ERC-165 identifier for this interface is 0xb0202a11.
   * 0xb0202a11 ===
   *   bytes4(keccak256('transferAndCall(address,uint256)')) ^
   *   bytes4(keccak256('transferAndCall(address,uint256,bytes)')) ^
   *   bytes4(keccak256('transferFromAndCall(address,address,uint256)')) ^
   *   bytes4(keccak256('transferFromAndCall(address,address,uint256,bytes)')) ^
   *   bytes4(keccak256('approveAndCall(address,uint256)')) ^
   *   bytes4(keccak256('approveAndCall(address,uint256,bytes)'))
   */

  /**
   * @notice Transfer tokens from `msg.sender` to another address and then call `onTransferReceived` on receiver
   * @param to address The address which you want to transfer to
   * @param value uint256 The amount of tokens to be transferred
   * @return true unless throwing
   */
  // function transferAndCall(address to, uint256 value) external returns (bool);

  /**
   * @notice Transfer tokens from `msg.sender` to another address and then call `onTransferReceived` on receiver
   * @param to address The address which you want to transfer to
   * @param value uint256 The amount of tokens to be transferred
   * @param data bytes Additional data with no specified format, sent in call to `to`
   * @return true unless throwing
   */
  // function transferAndCall(address to, uint256 value, bytes memory data) external returns (bool);

  /**
   * @notice Transfer tokens from one address to another and then call `onTransferReceived` on receiver
   * @param from address The address which you want to send tokens from
   * @param to address The address which you want to transfer to
   * @param value uint256 The amount of tokens to be transferred
   * @return true unless throwing
   */
  // function transferFromAndCall(address from, address to, uint256 value) external returns (bool);


  /**
   * @notice Transfer tokens from one address to another and then call `onTransferReceived` on receiver
   * @param from address The address which you want to send tokens from
   * @param to address The address which you want to transfer to
   * @param value uint256 The amount of tokens to be transferred
   * @param data bytes Additional data with no specified format, sent in call to `to`
   * @return true unless throwing
   */
  // function transferFromAndCall(address from, address to, uint256 value, bytes memory data) external returns (bool);

  /**
   * @notice Approve the passed address to spend the specified amount of tokens on behalf of msg.sender
   * and then call `onApprovalReceived` on spender.
   * @param spender address The address which will spend the funds
   * @param value uint256 The amount of tokens to be spent
   */
  // function approveAndCall(address spender, uint256 value) external returns (bool);

  /**
   * @notice Approve the passed address to spend the specified amount of tokens on behalf of msg.sender
   * and then call `onApprovalReceived` on spender.
   * @param spender address The address which will spend the funds
   * @param value uint256 The amount of tokens to be spent
   * @param data bytes Additional data with no specified format, sent in call to `spender`
   */
  // function approveAndCall(address spender, uint256 value, bytes memory data) external returns (bool);
}

interface ERC1363Spender {
  /*
   * Note: the ERC-165 identifier for this interface is 0x7b04a2d0.
   * 0x7b04a2d0 === bytes4(keccak256("onApprovalReceived(address,uint256,bytes)"))
   */

  /**
   * @notice Handle the approval of ERC1363 tokens
   * @dev Any ERC1363 smart contract calls this function on the recipient
   * after an `approve`. This function MAY throw to revert and reject the
   * approval. Return of other than the magic value MUST result in the
   * transaction being reverted.
   * Note: the token contract address is always the message sender.
   * @param owner address The address which called `approveAndCall` function
   * @param value uint256 The amount of tokens to be spent
   * @param data bytes Additional data with no specified format
   * @return `bytes4(keccak256("onApprovalReceived(address,uint256,bytes)"))`
   *  unless throwing
   */
  function onApprovalReceived(address owner, uint256 value, bytes memory data) external returns (bytes4);
}


// interface ERC165 {
//   function supportsInterface(bytes4 interfaceId) external view returns (bool);
// }