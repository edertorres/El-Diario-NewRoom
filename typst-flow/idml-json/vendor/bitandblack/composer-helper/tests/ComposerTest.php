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

use BitAndBlack\Composer\Composer;
use Composer\Autoload\ClassLoader;
use Composer\Autoload\MissingClass;
use PHPUnit\Framework\TestCase;
use TEST;

/**
 * Class ComposerTest
 *
 * @package BitAndBlack\Composer\Tests
 */
class ComposerTest extends TestCase
{
    /**
     * Tests if classes ca be found.
     */
    public function testCanFindClass(): void
    {
        /**
         * If this function returns true some day, this method will no longer be needed.
         */
        self::assertFalse(
            class_exists(TEST::class, false)
        );

        self::assertTrue(
            Composer::classExists(TEST::class)
        );

        self::assertTrue(
            Composer::classExists(ClassLoader::class)
        );

        self::assertFalse(
            /** @phpstan-ignore-next-line */
            Composer::classExists(MissingClass::class)
        );
        
        self::assertFalse(
            /** @phpstan-ignore-next-line */
            Composer::classExists(\MissingNamespace\ClassLoader::class)
        );
    }
}
