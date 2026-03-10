# Changes in Composer Helper

## 0.4.1 2020-11-24

### Fixed

-   Changed error type in `getVendorPath` to `E_USER_NOTICE`.

### Added 

-   Added support for PHP 8.

## 0.4.0 2020-10-02

### Fixed 

-   The handling of paths has been improved. This makes it possible to run properly in different environments like MacOS and Windows.

### Changed 

-   `Composer::getVendorPath()` has been deprecated. The class `VendorPath` has been added and can be used instead.