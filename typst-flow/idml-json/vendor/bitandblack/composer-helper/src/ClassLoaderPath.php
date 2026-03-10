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

use Composer\Autoload\ClassLoader;
use ReflectionClass;

/**
 * The ClassLoaderPath class finds and returns the path to composer's `ClassLoader.php`.
 *
 * @package BitAndBlack\Composer
 */
class ClassLoaderPath
{
    private string $fileName;
    
    /**
     * ClassLoaderPath constructor.
     */
    public function __construct()
    {
        $reflector = new ReflectionClass(ClassLoader::class);
        $this->fileName = (string) $reflector->getFileName();
    }

    /**
     * @return string
     */
    public function __toString(): string
    {
        return $this->getFileName();
    }

    /**
     * @return string
     */
    public function getFileName(): string
    {
        return $this->fileName;
    }
}
