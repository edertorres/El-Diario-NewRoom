<?php

/**
 * Bit&Black Composer Helper.
 *
 * @author Tobias Köngeter
 * @copyright Copyright © Bit&Black
 * @link https://www.bitandblack.com
 * @license MIT
 */

namespace BitAndBlack\Composer\Tests;

use BitAndBlack\Composer\Exception\VendorNotFoundException;
use BitAndBlack\Composer\VendorPath;
use PHPUnit\Framework\TestCase;

/**
 * Class VendorPathTest.
 *
 * @package BitAndBlack\Composer\Tests
 */
class VendorPathTest extends TestCase
{
    public function testCanGetVendor(): void
    {
        $path = (string) new VendorPath();

        self::assertSame(
            dirname(__DIR__) . DIRECTORY_SEPARATOR . 'vendor',
            $path
        );
    }

    /**
     * @throws VendorNotFoundException
     */
    public function testCanDisableCheckForExistence(): void
    {
        $vendorPath = new VendorPath();
        $vendorPath->disableCheckForExistence();
        $vendorPath->setClassLoaderPath(DIRECTORY_SEPARATOR . 'some' . DIRECTORY_SEPARATOR . 'path' . DIRECTORY_SEPARATOR . 'to' . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'composer' . DIRECTORY_SEPARATOR . 'ClassLoader.php');

        self::assertSame(
            DIRECTORY_SEPARATOR . 'some' . DIRECTORY_SEPARATOR . 'path' . DIRECTORY_SEPARATOR . 'to' . DIRECTORY_SEPARATOR . 'vendor',
            $vendorPath->getVendorPath()
        );
    }

    /**
     * @throws VendorNotFoundException
     */
    public function testCanCheckForExistence(): void
    {
        $this->expectException(VendorNotFoundException::class);
        $vendorPath = new VendorPath();
        $vendorPath->setClassLoaderPath(DIRECTORY_SEPARATOR . 'some' . DIRECTORY_SEPARATOR . 'path' . DIRECTORY_SEPARATOR . 'to' . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'composer' . DIRECTORY_SEPARATOR . 'ClassLoader.php');
        $vendorPath->getVendorPath();
    }

    public function testCanGetVendorInWordPress(): void
    {
        define('ABSPATH', true);

        $path = (string) new VendorPath();

        self::assertSame(
            dirname(__DIR__) . DIRECTORY_SEPARATOR . 'vendor',
            $path
        );
    }
}
