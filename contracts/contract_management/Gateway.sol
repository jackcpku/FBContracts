// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../common/IBaseNFTManagement.sol";

contract Gateway is Initializable, AccessControl {
    /********************************************************************
     *                          Role System                             *
     ********************************************************************/

    /**
     * Gateway manager role
     */
    bytes32 public constant GATEWAY_MANAGER_ROLE =
        keccak256("GATEWAY_MANAGER_ROLE");

    /**
     * Factory role
     */
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");

    /**
     * Reserved slots
     */
    bytes32 public constant RESERVED_ROLE1 = keccak256("RESERVED_ROLE1");
    bytes32 public constant RESERVED_ROLE2 = keccak256("RESERVED_ROLE2");

    /********************************************************************
     *                      Priviledge addresses                        *
     ********************************************************************/

    /**
     * The multi-sig wallet address that controls this contract
     */
    address gatewayManager;

    /**
     * Store the contract factory address. This is needed because the
     * factory should be granted to assign a manager with a newly deployed
     * NFT contract.
     */
    address factoryAddress;

    address RESERVED_ADDRESS1;
    address RESERVED_ADDRESS2;

    /**
     * Store a one-to-one relationship between a certain nft contract
     * and a manager address.
     */
    mapping(address => address) nftcontract2manager;

    event GatewayOwnershipTransferred(
        address indexed previousGatewayManager,
        address indexed newGatewayManager
    );

    event ManagerAssigned(
        address indexed contractAddress,
        address indexed previousContractManager,
        address indexed newContractManager
    );

    modifier onlyManagerOf(address _nftContract) {
        require(
            msg.sender == nftcontract2manager[_nftContract],
            "Unauthorized"
        );
        _;
    }

    /**
     * Gateway is an upgradeable function.
     * When initializing the gateway, a gateway manager address
     * should be designated.
     */
    function initialize(address _gatewayManager) public initializer {
        gatewayManager = _gatewayManager;

        _grantRole(DEFAULT_ADMIN_ROLE, gatewayManager);
        _grantRole(GATEWAY_MANAGER_ROLE, gatewayManager);
    }

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

    /**
     * Set the manager of a certain NFT contract.
     * @notice Only the gateway manager and factory contract should call this function.
     */
    function setManagerOf(address _nftContract, address _manager) public {
        require(
            hasRole(GATEWAY_MANAGER_ROLE, msg.sender) ||
                hasRole(FACTORY_ROLE, msg.sender),
            "Only gateway manager and factory contract are authorized"
        );

        emit ManagerAssigned(
            _nftContract,
            nftcontract2manager[_nftContract],
            _manager
        );

        nftcontract2manager[_nftContract] = _manager;
    }

    /**
     * Set the contract factory address.
     * @notice Only the gateway manager should call this function.
     */
    function setFactoryAddress(address _factory)
        public
        onlyRole(GATEWAY_MANAGER_ROLE)
    {
        revokeRole(FACTORY_ROLE, factoryAddress);
        grantRole(FACTORY_ROLE, _factory);
        factoryAddress = _factory;
    }

    /**
     * This is the only way of changing the gateway of a certain contract.
     * @notice Should be rarely called.
     */
    function setGatewayOf(address _nftContract, address _newGateway)
        public
        onlyRole(GATEWAY_MANAGER_ROLE)
    {
        require(_newGateway != address(this), "Should assign a new gateway");

        nftcontract2manager[_nftContract] = address(0);
        IBaseNFTManagement(_nftContract).setGateway(_newGateway);
    }

    /**
     * Change the gateway manager address.
     * @notice Should be rarely called.
     */
    function transferGatewayOwnership(address _gatewayManager)
        public
        onlyRole(GATEWAY_MANAGER_ROLE)
    {
        emit GatewayOwnershipTransferred(gatewayManager, _gatewayManager);

        // The previous gateway manager renounces his roles
        // TODO rotation period
        renounceRole(DEFAULT_ADMIN_ROLE, gatewayManager);
        renounceRole(GATEWAY_MANAGER_ROLE, gatewayManager);

        _grantRole(DEFAULT_ADMIN_ROLE, _gatewayManager);
        _grantRole(GATEWAY_MANAGER_ROLE, _gatewayManager);

        gatewayManager = _gatewayManager;
    }
}
