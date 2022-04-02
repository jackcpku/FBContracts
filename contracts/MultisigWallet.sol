// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MultisigWallet {
    // m out of n parties are needed for a certain transaction
    uint256 m;
    uint256 n;

    bytes32 messageId;
    mapping(bytes32 => uint256) approvedNum;

    mapping(bytes32 => mapping(address => bool)) approvedInfo;

    mapping(address => bool) signers;

    modifier onlyMultisigWalletSigner(bytes32 _messageId) {
        require(signers[msg.sender], "MultisigWallet: not a signer");

        if (
            !approvedInfo[_messageId][msg.sender] && approvedNum[_messageId] < m
        ) {
            approvedInfo[_messageId][msg.sender] = true;
            approvedNum[_messageId] += 1;

            if (approvedNum[_messageId] >= m) {
                _;
            }
        }
    }

    constructor(
        uint256 _m,
        uint256 _n,
        address[] memory _signers
    ) {
        m = _m;
        n = _n;

        require(_signers.length == _n, "MultisigWallet: bad parameters");

        for (uint256 i = 0; i < _n; i++) {
            signers[_signers[i]] = true;
        }
    }
}
