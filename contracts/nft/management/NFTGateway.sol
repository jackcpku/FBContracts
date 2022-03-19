// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../interfaces/INFTGateway.sol";
import "../interfaces/IBaseNFTManagement.sol";

import "../BasicERC721.sol";
import "../BasicERC1155.sol";

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

    event TransferGatewayOwnership(
        address indexed previousGatewayManager,
        address indexed newGatewayManager
    );

    event AssignManager(
        address indexed assigner,
        address indexed contractAddress,
        address previousContractManager,
        address indexed newContractManager
    );

    modifier onlyManagerOf(address _nftContract) {
        require(
            isInManagement(msg.sender, _nftContract),
            "Gateway: caller is not manager of the nft contract"
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
        BasicERC721(_nftContract).mint(_recipient, _tokenId);
    }

    function ERC721_burn(address _nftContract, uint256 _tokenId)
        external
        override
        onlyManagerOf(_nftContract)
    {
        BasicERC721(_nftContract).burn(_tokenId);
    }

    function ERC721_setURI(address _nftContract, string calldata _newURI)
        external
        override
        onlyManagerOf(_nftContract)
    {
        BasicERC721(_nftContract).setURI(_newURI);
    }

    function ERC1155_mint(
        address _nftContract,
        address _account,
        uint256 _id,
        uint256 _amount,
        bytes calldata _data
    ) external override onlyManagerOf(_nftContract) {
        BasicERC1155(_nftContract).mint(_account, _id, _amount, _data);
    }

    function ERC1155_mintBatch(
        address _nftContract,
        address _to,
        uint256[] calldata _ids,
        uint256[] calldata _amounts,
        bytes calldata _data
    ) external override onlyManagerOf(_nftContract) {
        BasicERC1155(_nftContract).mintBatch(_to, _ids, _amounts, _data);
    }

    function ERC1155_burn(
        address _nftContract,
        address _account,
        uint256 _id,
        uint256 _value
    ) external override onlyManagerOf(_nftContract) {
        BasicERC1155(_nftContract).burn(_account, _id, _value);
    }

    function ERC1155_burnBatch(
        address _nftContract,
        address _account,
        uint256[] calldata _ids,
        uint256[] calldata _values
    ) external override onlyManagerOf(_nftContract) {
        BasicERC1155(_nftContract).burnBatch(_account, _ids, _values);
    }

    function ERC1155_setURI(address _nftContract, string calldata _newuri)
        external
        override
        onlyManagerOf(_nftContract)
    {
        BasicERC1155(_nftContract).setURI(_newuri);
    }

    /********************************************************************
     *                       Manage nft managers                        *
     ********************************************************************/

    /**
     * Set the manager of a certain NFT contract.
     */
    function setManagerOf(address _nftContract, address _manager)
        external
        override
        onlyRole(GATEWAY_MANAGER_ROLE)
    {
        emit AssignManager(
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
    function addManager(address _manager)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _grantRole(GATEWAY_MANAGER_ROLE, _manager);
    }

    /**
     * Remove a manager
     * @notice Only the admin should call this function.
     */
    function removeManager(address _manager)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _revokeRole(GATEWAY_MANAGER_ROLE, _manager);
    }

    /**
     * This is the only way of changing the gateway of a certain contract.
     * @notice Should be rarely called.
     */
    function setGatewayOf(address _nftContract, address _newGateway)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            _newGateway != address(this),
            "Gateway: new gateway should be different than the current one"
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
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            _gatewayAdmin != msg.sender,
            "Gateway: new gateway admin should be different than the current one"
        );

        emit TransferGatewayOwnership(msg.sender, _gatewayAdmin);

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
}
