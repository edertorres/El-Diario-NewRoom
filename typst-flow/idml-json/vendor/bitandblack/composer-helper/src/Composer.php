<?php

/**
 * Bit&Black Composer Helper.
 *
 * @author Tobias Köngeter
 * @copyright Copyright © Bit&Black
 * @link https://www.bitandblack.com
 * @license MIT
 */

namespace BitAndBlack\Composer;

use ReflectionClass;
use ReflectionException;

/**
 * Class Composer
 *
 * @package BitAndBlack\Composer
 */
class Composer
{
    /**
     * Returns if a class exists. This is a replacement for `class_exists()` which may not work with Composer.
     *
     * @param string $class
     * @return bool
     */
    public static function classExists(string $class): bool
    {
        try {
            /** @phpstan-ignore-next-line */
            $reflection = new ReflectionClass($class);
            $classFound = (string) $reflection->getName();
        } catch (ReflectionException $exception) {
            return false;
        }

        return $classFound === $class;
    }
}
