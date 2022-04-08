// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MultisigWallet is Ownable {
    // m out of n parties are needed for a certain transaction
    uint256 m;
    uint256 n;

    bytes32 messageId;

    mapping(bytes32 => uint256) approvedNum;

    mapping(bytes32 => mapping(address => bool)) approvedInfo;

    mapping(address => bool) signers;

    mapping(bytes32 => bool) done;

    modifier onlyMultisigWalletSigner(bytes32 _messageId) {
        require(signers[msg.sender], "MultisigWallet: not a signer");

        if (!approvedInfo[_messageId][msg.sender] && !done[_messageId]) {
            approvedInfo[_messageId][msg.sender] = true;
            approvedNum[_messageId] += 1;

            if (approvedNum[_messageId] >= m) {
                done[_messageId] = true;
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

        require(m <= n, "MultisigWallet: m should not be greater than n");
        require(_signers.length == n, "MultisigWallet: bad parameters");

        for (uint256 i = 0; i < _n; i++) {
            signers[_signers[i]] = true;
        }
    }

    function setM(uint256 _m) external onlyOwner {
        require(_m <= n, "MultisigWallet: m should not be greater than n");
        m = _m;
    }

    function updateSigners(
        uint256 _newm,
        uint256 _newn,
        address[] memory _newSigners,
        address[] memory _oldSigners
    ) external onlyOwner {
        _removeOldSigners(_oldSigners);

        m = _newm;
        n = _newn;

        require(m <= n, "MultisigWallet: m should not be greater than n");
        require(_newSigners.length == n, "MultisigWallet: bad parameters");

        for (uint256 i = 0; i < n; i++) {
            signers[_newSigners[i]] = true;
        }
    }

    function _removeOldSigners(address[] memory _oldSigners) internal {
        require(
            _oldSigners.length == n,
            "MultisigWallet: wrong oldSigners length"
        );

        for (uint256 i = 0; i < n; i++) {
            require(
                signers[_oldSigners[i]] == true,
                "MultisigWallet: old signer does not exist"
            );
            signers[_oldSigners[i]] = false;
        }
    }
}
