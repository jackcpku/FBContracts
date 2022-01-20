// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

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
     * Record when the previous gateway manager starts transferring ownership.
     */
    uint256 graceTimeStart;

    /**
     * Store the previous gateway manager address
     */
    address previousGatewayManager;

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
        grantRole(GATEWAY_MANAGER_ROLE, _manager);
    }

    /**
     * Remove a manager
     * @notice Only the admin should call this function.
     */
    function removeManager(address _manager)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        revokeRole(GATEWAY_MANAGER_ROLE, _manager);
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
        // Revert if it has not been 1 day since last ownership transfer.
        // This assures no more than one grace admins exist at the same time.
        require(block.timestamp > graceTimeStart + 1 days);

        require(
            _gatewayAdmin != msg.sender,
            "Should set a different gateway manager"
        );

        emit GatewayOwnershipTransferred(msg.sender, _gatewayAdmin);

        // The new gateway manager picks up his role.
        grantRole(DEFAULT_ADMIN_ROLE, _gatewayAdmin);

        // The previous gateway manager renounces his big role.
        renounceRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
}
