// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../common/IBaseNFTManagement.sol";

contract Gateway is Initializable {
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

    /**
     * Store a one-to-one relationship between a certain nft contract
     * and a manager address.
     */
    mapping(address => address) nftcontract2manager;

    event GatewayOwnershipTransferred(
        address indexed originalGatewayManager,
        address indexed newGatewayManager
    );

    event ManagerAssigned(
        address indexed contractAddress,
        address indexed originalContractManager,
        address indexed newContractManager
    );

    modifier onlyGatewayManager() {
        require(msg.sender == gatewayManager, "Unauthorized");
        _;
    }

    modifier onlyManagerOf(address _nftContract) {
        require(
            msg.sender == nftcontract2manager[_nftContract],
            "Unauthorized"
        );
        _;
    }

    function initialize() public initializer {
        gatewayManager = msg.sender;
    }

    /**
     * The entrance point to managing a certain NFT contract.
     * Mint an NFT of the given contract and send it to recipient.
     * @param _nftContract The target NFT contract.
     * @param _recipient Whom should the newly minted NFT belong to.
     * @param _metaUri The MetaURI of the newly minted NFT.
     */
    function mint(
        address _nftContract,
        address _recipient,
        string memory _metaUri
    ) public onlyManagerOf(_nftContract) {
        IBaseNFTManagement(_nftContract).mint(_recipient, _metaUri);
    }

    /**
     * The entrance point to managing a certain NFT contract.
     * Set the metauri of a certain NFT given the contract address and tokenId.
     * @param _nftContract The target NFT contract.
     * @param _tokenId Which token of the contract to modify.
     * @param _metaUri Set the MetaURI of the NFT.
     */
    function setMetaUri(
        address _nftContract,
        uint256 _tokenId,
        string memory _metaUri
    ) public onlyManagerOf(_nftContract) {
        IBaseNFTManagement(_nftContract).setMetaUri(_tokenId, _metaUri);
    }

    /**
     * Set the manager of a certain NFT contract.
     * @notice Only the gateway manager and factory contract should call this function.
     */
    function setManagerOf(address _nftContract, address _manager) public {
        require(
            msg.sender == gatewayManager || msg.sender == factoryAddress,
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
    function setFactoryAddress(address _factory) public onlyGatewayManager {
        factoryAddress = _factory;
    }

    /**
     * Change the gateway manager address.
     * @notice Should be rarely called.
     */
    function transferGatewayOwnership(address _gatewayManager)
        public
        onlyGatewayManager
    {
        emit GatewayOwnershipTransferred(gatewayManager, _gatewayManager);

        gatewayManager = _gatewayManager;
    }
}
