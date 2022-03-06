// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../common/INFTGateway.sol";
import "../common/IBaseNFTManagement.sol";

import "../ERC721Base.sol";
import "../ERC1155Base.sol";

contract NFTGateway is Initializable, AccessControl, INFTGateway {
    /********************************************************************
     *                          Role System                             *
     ********************************************************************/

    /**
     * The role responsible for setting manager of contracts.
     * @notice Can only call `setManagerOf`.
     */
    bytes32 public constant GATEWAY_MANAGER_ROLE =
        keccak256("GATEWAY_MANAGER_ROLE");

    /**
     * Store a one-to-one relationship between a certain nft contract
     * and a manager address.
     */
    mapping(address => address) public nftManager;
    mapping(address => address) nftPreviousManager;
    mapping(address => uint256) nftManagerGraceTimeStart;

    /**
     * Deprecated variable.
     */
    address previousGatewayManager;

    mapping(bytes => bool) usedSignagure;

    event GatewayOwnershipTransferred(
        address indexed previousGatewayManager,
        address indexed newGatewayManager
    );

    event ManagerAssigned(
        address indexed assigner,
        address indexed contractAddress,
        address previousContractManager,
        address indexed newContractManager
    );

    modifier onlyManagerOf(address _nftContract) {
        require(isInManagement(msg.sender, _nftContract), "Unauthorized");
        _;
    }

    /**
     * Check if a signature has already been used.
     * Modifier used in every user-delegated calls.
     */
    modifier checkUsedSignature(bytes memory _managerSig) {
        require(!usedSignagure[_managerSig], "Gateway: used manager signature");
        _;
        usedSignagure[_managerSig] = true;
    }

    /**
     * Check if a signature has expired.
     * Modifier used in every user-delegated calls.
     */
    modifier checkExpire(uint256 _expire) {
        require(
            _expire == 0 || block.timestamp < _expire,
            "Gateway: expired signature"
        );
        _;
    }

    /**
     * NFTGateway is an upgradeable function.
     * When initializing the gateway, a gateway admin address
     * should be designated.
     */
    function initialize(address _gatewayAdmin) public initializer {
        _grantRole(DEFAULT_ADMIN_ROLE, _gatewayAdmin);
    }

    /********************************************************************
     *               Interfaces exposed to nft managers                 *
     ********************************************************************/

    function ERC721_mint(
        address _nftContract,
        address _recipient,
        uint256 _tokenId
    ) external override onlyManagerOf(_nftContract) {
        ERC721Base(_nftContract).mint(_recipient, _tokenId);
    }

    function ERC721_burn(address _nftContract, uint256 _tokenId)
        external
        override
        onlyManagerOf(_nftContract)
    {
        ERC721Base(_nftContract).burn(_tokenId);
    }

    function ERC721_setURI(address _nftContract, string memory _newURI)
        external
        override
        onlyManagerOf(_nftContract)
    {
        ERC721Base(_nftContract).setURI(_newURI);
    }

    function ERC1155_mint(
        address _nftContract,
        address _account,
        uint256 _id,
        uint256 _amount,
        bytes memory _data
    ) external override onlyManagerOf(_nftContract) {
        ERC1155Base(_nftContract).mint(_account, _id, _amount, _data);
    }

    function ERC1155_mintBatch(
        address _nftContract,
        address _to,
        uint256[] memory _ids,
        uint256[] memory _amounts,
        bytes memory _data
    ) external override onlyManagerOf(_nftContract) {
        ERC1155Base(_nftContract).mintBatch(_to, _ids, _amounts, _data);
    }

    function ERC1155_burn(
        address _nftContract,
        address _account,
        uint256 _id,
        uint256 _value
    ) external override onlyManagerOf(_nftContract) {
        ERC1155Base(_nftContract).burn(_account, _id, _value);
    }

    function ERC1155_burnBatch(
        address _nftContract,
        address _account,
        uint256[] memory _ids,
        uint256[] memory _values
    ) external override onlyManagerOf(_nftContract) {
        ERC1155Base(_nftContract).burnBatch(_account, _ids, _values);
    }

    function ERC1155_setURI(address _nftContract, string memory _newuri)
        external
        override
        onlyManagerOf(_nftContract)
    {
        ERC1155Base(_nftContract).setURI(_newuri);
    }

    /********************************************************************
     *      Interfaces exposed to anyone on behalf of nft managers      *
     ********************************************************************/

    /**
     * This is the delegated version of mint()
     * Anyone can mint if they have the manager's signature
     * @param _nftContract The target NFT contract.
     * @param _recipient Whom should the newly minted NFT belong to.
     * @param _tokenId The tokenId of the newly minted NFT.
     * @param _expire Signature's expire moment. If 0, never expire.
     * @param _saltNonce Random nonce used against replay attacks.
     * @param _managerSig The manager's signature mint action.
     */
    function delegatedMint(
        address _nftContract,
        address _recipient,
        uint256 _tokenId,
        uint256 _expire,
        bytes memory _saltNonce,
        bytes memory _managerSig
    ) public checkUsedSignature(_managerSig) checkExpire(_expire) {
        /**
         * Check signature
         */
        bytes32 criteriaMessageHash = getMessageHash(
            _nftContract,
            _recipient,
            _tokenId,
            _expire,
            _saltNonce
        );
        bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(
            criteriaMessageHash
        );
        require(
            ECDSA.recover(ethSignedMessageHash, _managerSig) ==
                nftManager[_nftContract],
            "Gateway: invalid manager signature"
        );

        ERC721Base(_nftContract).mint(_recipient, _tokenId);
    }

    /********************************************************************
     *                       Manage nft managers                        *
     ********************************************************************/

    /**
     * Set the manager of a certain NFT contract.
     */
    function setManagerOf(address _nftContract, address _manager)
        public
        onlyRole(GATEWAY_MANAGER_ROLE)
    {
        emit ManagerAssigned(
            msg.sender,
            _nftContract,
            nftManager[_nftContract],
            _manager
        );

        nftPreviousManager[_nftContract] = nftManager[_nftContract];
        nftManagerGraceTimeStart[_nftContract] = block.timestamp;

        nftManager[_nftContract] = _manager;
    }

    /********************************************************************
     *                      Admin-only functions                        *
     ********************************************************************/

    /**
     * Add a manager
     * @notice Only the admin should call this function.
     */
    function addManager(address _manager) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(GATEWAY_MANAGER_ROLE, _manager);
    }

    /**
     * Remove a manager
     * @notice Only the admin should call this function.
     */
    function removeManager(address _manager)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _revokeRole(GATEWAY_MANAGER_ROLE, _manager);
    }

    /**
     * This is the only way of changing the gateway of a certain contract.
     * @notice Should be rarely called.
     */
    function setGatewayOf(address _nftContract, address _newGateway)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            _newGateway != address(this),
            "Should assign a different gateway"
        );

        nftManager[_nftContract] = address(0);
        nftPreviousManager[_nftContract] = address(0);
        IBaseNFTManagement(_nftContract).setGateway(_newGateway);
    }

    /**
     * Change the gateway manager address.
     * @notice Should be rarely called.
     */
    function transferGatewayOwnership(address _gatewayAdmin)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            _gatewayAdmin != msg.sender,
            "Should set a different gateway manager"
        );

        emit GatewayOwnershipTransferred(msg.sender, _gatewayAdmin);

        // The new gateway manager picks up his role.
        _grantRole(DEFAULT_ADMIN_ROLE, _gatewayAdmin);

        // The previous gateway manager renounces his big role.
        _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /********************************************************************
     *                        Helper functions                          *
     ********************************************************************/

    /**
     * @dev Check if address `_x` is in management.
     * @notice If `_x` is the previous manager and the grace period has not
     * passed, still returns true.
     */
    function isInManagement(address _x, address _nftContract)
        public
        view
        returns (bool)
    {
        return
            _x == nftManager[_nftContract] ||
            (_x == nftPreviousManager[_nftContract] &&
                block.timestamp <
                nftManagerGraceTimeStart[_nftContract] + 1 days);
    }

    /**
     * For delegatedMint()
     */
    function getMessageHash(
        address _nftContract,
        address _recipient,
        uint256 _tokenId,
        uint256 _expire,
        bytes memory _saltNonce
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _nftContract,
                    _recipient,
                    _tokenId,
                    _expire,
                    _saltNonce
                )
            );
    }
}
