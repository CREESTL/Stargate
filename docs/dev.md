# Stargate контракты для разработчиков
В данном документе описываются изменения во взаимодействии с контрактом Bridge.sol в связи с рефакторингом и добавлением новых функций.


## Унификация функций lock, unlock, burn, mint
В отличие от старой версии контракта, теперь мы используем одни и те же функции для всех типов токенов (например mintWithPermit вместо mintWithPermitERC20, mintWithPermitERC721 и.т.д.)
- [lockWithPermit](#assets-bridgeparams-1)
- [unlockWithPermit](#assets-bridgeparams-1)
- [burnWithPermit](#assets-bridgeparams-1)
- [mintWithPermit](#assets-bridgeparams-1)

## Изменения в оплате комиссии
Теперь пользователи платят комиссии за lock и burn операции по выбору либо в stargate (ST), либо в токенах которые они бриджат (TT). Также в случае ERC721, ERC1155 для оплаты комиссии используются USD стейблкойн. Для этого бэк должен предоставить обменный курс  USD/ST, USD/TT.
> В зависимости от способа оплаты комиссии перед вызовом методов lock/burn пользователь должен заапрувить контракту бриджа токены ST, TT или стейблкойн.

## Новый permitTypeHash
```
function getPermitTypeHash(receiver, amount, tokenId, nonce) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'string', 'uint256', 'uint256', 'uint256'],
			[
			keccak256(toUtf8Bytes(
        "Permit(address receiver,uint256 amount,uint256 tokenId, uint256 nonce)"
      )),
			receiver,
		  amount,
      tokenId,
			nonce,
			]
		)
	);
}
```
Добавился дополнительный аргумент **tokenId**, его оставляем равным нулю в случае операций с  ERC20, Native  токенами. В случае операций с ERC721 - **amount** должен быть равен 1.

## Новый domain separator
```
function getDomainSeparator(version, chainId, verifyingAddress) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
			[
			keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingAddress)')),
			keccak256(toUtf8Bytes('StargateBridge')),
			keccak256(toUtf8Bytes(version)),
			chainId,
			verifyingAddress,
			]
		)
	);
}
```
В отличие от старой версии мы теперь везде используем **"StargateBridge"** в качестве name.

## lockWithPermit, burnWithPermit
Для этих функций теперь тоже нужно расчитывать хэш и подписывать сигнатуры. 
```
function getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokenAmountForOneUsd, nonce) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'uint256', 'uint256', 'uint256'],
			[
			keccak256(toUtf8Bytes(
        "VerifyPrice(uint256 stargateAmountForOneUsd,uint256 transferedTokensAmountForOneUsd, uint256 nonce)"
      )),
			stargateAmountForOneUsd,
			transferedTokensAmountForOneUsd,
      nonce
			]
		)
	);
}
```
Вместо PermitTypeHash используется VerifyPriceHash.
- stargateAmountForOneUsd - курс USD/ST
- transferedTokenAmountForOneUsd - курс USD/TT
## Assets, BridgeParams
Все основные функции принимают два аргумета
- Assets assetType - enum переменная задающая тип токена
- BridgeParams params - объект с параметрами для той или иной операции
### Assets
- 0 - Native токен ( ETH, BNB, MATIC  и пр.)
- 1 -  ERC20
- 2 - ERC721
- 3 - ERC1155

### BridgeParams
- amount - количество токенов (1 если ERC721)
- token -  адрес токена (нулевой адрес если нативный токен)
- tokenId - ID токена если операция проводится с ERC721,1155. В противном случае 0
- receiver - string получателя токенов на другом конце бриджа (в другой сети)
- targetChain - string сети куда переносятся токены
- stargateAmountForOneUsd - курс USD/ST (0 если операция unlock/mint)
- transferedTokensAmountForOneUsd - курс USD/TT (0 если операция unlock/mint)
- payFeesWithST - true - оплата комиссий в ST, false в TT
- nonce
- v
- r
- s - параметры для верификации сигнатуры
> **При вызове функций mint и unlock receiver ДОЛЖЕН БЫТЬ РАВЕН адресу который инициировал транзакцию (бэк или фронт должны его подставить сами)**

## Events
Новые ивенты теперь называются просто Lock, Burn, Unlock, Mint и несут в себе одинаковый набор параметров
```
        Assets assetType,
        address indexed sender,
        string receiver,
        uint256 amount,
        address indexed token,
        uint256 indexed tokenId,
        string targetChain
```
## CalcFee
Хелпер функции для расчета комиссии 

### CalcFeeScaled
- amount
- stargateAmountForOneUsd - курс USD/ST (0 если операция unlock/mint)
- transferedTokensAmountForOneUsd - курс USD/TT (0 если операция unlock/mint)
- payFeesWithST - true - оплата комиссий в ST, false в TT

### CalcFeeFixed
- amount
- stargateAmountForOneUsd - курс USD/ST (0 если операция unlock/mint)
- payFeesWithST - true - оплата комиссий в ST, false в TT

## lastNonce
Теперь можно посмотреть последний верифицированный nonce, вызвав функцию **bridge.lastNonce()**.

