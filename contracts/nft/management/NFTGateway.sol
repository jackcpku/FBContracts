// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../common/IBaseNFTManagement.sol";

contract NFTGateway is Initializable, AccessControl {
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
    mapping(address => address) nftManager;
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
        require(
            msg.sender == nftManager[_nftContract] ||
                (msg.sender == nftPreviousManager[_nftContract] &&
                    block.timestamp <
                    nftManagerGraceTimeStart[_nftContract] + 1 days),
            "Unauthorized"
        );
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

    /**
     * The entrance point to managing a certain NFT contract.
     * Mint an NFT of the given contract and send it to recipient.
     * @param _nftContract The target NFT contract.
     * @param _recipient Whom should the newly minted NFT belong to.
     * @param _tokenURI The meta data URI of the newly minted NFT.
     */
    function mint(
        address _nftContract,
        address _recipient,
        string memory _tokenURI
    ) public onlyManagerOf(_nftContract) {
        IBaseNFTManagement(_nftContract).mint(_recipient, _tokenURI);
    }

    /**
     * The entrance point to managing a certain NFT contract.
     * Set the tokenURI of a certain NFT given the contract address and tokenId.
     * @param _nftContract The target NFT contract.
     * @param _tokenId Which token of the contract to modify.
     * @param _tokenURI Set the meta data URI of the NFT.
     */
    function setTokenURI(
        address _nftContract,
        uint256 _tokenId,
        string memory _tokenURI
    ) public onlyManagerOf(_nftContract) {
        IBaseNFTManagement(_nftContract).setTokenURI(_tokenId, _tokenURI);
    }

    /********************************************************************
     *      Interfaces exposed to anyone on behalf of nft managers      *
     ********************************************************************/

    /**
     * This is the delegated version of mint()
     * Anyone can mint if they have the manager's signature
     * @param _nftContract The target NFT contract.
     * @param _recipient Whom should the newly minted NFT belong to.
     * @param _managerSig The manager's signature of mint info.
     * @param _saltNonce Random nonce used against replay attacks.
     * @param _tokenURI The meta data URI of the newly minted NFT.
     */
    function delegatedMint(
        address _nftContract,
        address _recipient,
        bytes memory _managerSig,
        bytes memory _saltNonce,
        string memory _tokenURI
    ) public checkUsedSignature(_managerSig) {
        /**
         * Check signature
         */
        bytes32 criteriaMessageHash = getMessageHash(
            _nftContract,
            _recipient,
            _saltNonce,
            _tokenURI
        );
        bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(
            criteriaMessageHash
        );
        require(
            ECDSA.recover(ethSignedMessageHash, _managerSig) ==
                nftManager[_nftContract],
            "Gateway: invalid manager signature"
        );

        IBaseNFTManagement(_nftContract).mint(_recipient, _tokenURI);
    }

    /**
     * This is the delegated version of setTokenURI()
     * Anyone can setTokenURI if they have the manager's signature
     * @param _nftContract The target NFT contract.
     * @param _tokenId Which token of the contract to modify.
     * @param _managerSig The manager's signature of setTokenURI process.
     * @param _saltNonce Random nonce used against replay attacks.
     * @param _tokenURI Set the meta data URI of the NFT.
     */
    function delegatedSetTokenURI(
        address _nftContract,
        uint256 _tokenId,
        bytes memory _managerSig,
        bytes memory _saltNonce,
        string memory _tokenURI
    ) public checkUsedSignature(_managerSig) {
        /**
         * Check signature
         */
        bytes32 criteriaMessageHash = getMessageHash(
            _nftContract,
            _tokenId,
            _saltNonce,
            _tokenURI
        );
        bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(
            criteriaMessageHash
        );
        require(
            ECDSA.recover(ethSignedMessageHash, _managerSig) ==
                nftManager[_nftContract],
            "Gateway: invalid manager signature"
        );
        IBaseNFTManagement(_nftContract).setTokenURI(_tokenId, _tokenURI);
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

    function getMessageHash(
        address _nftContract,
        address _recipient,
        bytes memory _saltNonce,
        string memory _tokenURI
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _nftContract,
                    _recipient,
                    _saltNonce,
                    _tokenURI
                )
            );
    }

    function getMessageHash(
        address _nftContract,
        uint256 _tokenId,
        bytes memory _saltNonce,
        string memory _tokenURI
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(_nftContract, _tokenId, _saltNonce, _tokenURI)
            );
    }
}
